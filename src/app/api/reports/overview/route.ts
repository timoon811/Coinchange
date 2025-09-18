import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole, RequestStatus } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'
import { z } from 'zod'

// Схема валидации для параметров отчета
const overviewReportSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', 'month', 'year', 'custom']).default('7d'),
  officeId: z.string().optional(),
})

// GET /api/reports/overview - Получить общий отчет
export async function GET(request: NextRequest) {
  try {
    // Аутентифицируем пользователя
    let payload: AuthenticatedPayload

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    
    // Парсим и валидируем параметры
    const params = {
      period: searchParams.get('period') || '7d',
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      officeId: searchParams.get('officeId'),
    }

    const validationResult = overviewReportSchema.safeParse(params)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные параметры отчета',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const filters = validationResult.data

    // Определяем временной диапазон
    const now = new Date()
    let startDate: Date
    let endDate: Date = now

    if (filters.period === 'custom' && filters.dateFrom && filters.dateTo) {
      startDate = new Date(filters.dateFrom)
      endDate = new Date(filters.dateTo)
    } else {
      switch (filters.period) {
        case '7d':
          startDate = subDays(now, 7)
          break
        case '30d':
          startDate = subDays(now, 30)
          break
        case '90d':
          startDate = subDays(now, 90)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          break
        case 'year':
          startDate = new Date(now.getFullYear(), 0, 1)
          break
        default:
          startDate = subDays(now, 7)
      }
    }

    // Базовые условия для фильтрации (учитываем роли)
    let baseWhere: Record<string, unknown> = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    }

    // Фильтр по офисам для кассиров
    if (payload.role === UserRole.CASHIER && payload.officeIds) {
      baseWhere.officeId = {
        in: payload.officeIds,
      }
    } else if (filters.officeId) {
      baseWhere.officeId = filters.officeId
    }

    // Собираем данные параллельно
    const [
      totalRequests,
      completedRequests,
      canceledRequests,
      totalVolume,
      statusStats,
      directionStats,
      topClients,
      topOffices,
      dailyStats,
    ] = await Promise.all([
      // Общее количество заявок
      prisma.request.count({ where: baseWhere }),

      // Завершенные заявки
      prisma.request.count({
        where: {
          ...baseWhere,
          status: RequestStatus.COMPLETED,
        },
      }),

      // Отмененные заявки
      prisma.request.count({
        where: {
          ...baseWhere,
          status: {
            in: [RequestStatus.CANCELED, RequestStatus.REJECTED],
          },
        },
      }),

      // Общий объем через финансовую информацию
      prisma.requestFinance.aggregate({
        where: {
          request: baseWhere,
        },
        _sum: {
          expectedAmountFrom: true,
        },
      }),

      // Статистика по статусам
      prisma.request.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: {
          id: true,
        },
      }),

      // Статистика по направлениям
      prisma.request.groupBy({
        by: ['direction'],
        where: baseWhere,
        _count: {
          id: true,
        },
      }),

      // Топ клиенты по количеству заявок
      prisma.request.groupBy({
        by: ['clientId'],
        where: baseWhere,
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      }),

      // Топ офисы по количеству заявок
      prisma.request.groupBy({
        by: ['officeId'],
        where: {
          ...baseWhere,
          officeId: { not: null },
        },
        _count: {
          id: true,
        },
        orderBy: {
          _count: {
            id: 'desc',
          },
        },
        take: 10,
      }),

      // Дневная статистика за период
      Array.from({ length: 7 }, (_, i) => {
        const date = subDays(endDate, 6 - i)
        const dayStart = startOfDay(date)
        const dayEnd = endOfDay(date)
        
        return Promise.all([
          prisma.request.count({
            where: {
              ...baseWhere,
              createdAt: {
                gte: dayStart,
                lte: dayEnd,
              },
            },
          }),
          prisma.requestFinance.aggregate({
            where: {
              request: {
                ...baseWhere,
                createdAt: {
                  gte: dayStart,
                  lte: dayEnd,
                },
              },
            },
            _sum: {
              expectedAmountFrom: true,
            },
          }),
        ]).then(([requests, volume]) => ({
          date: format(date, 'yyyy-MM-dd'),
          requests,
          volume: Number(volume._sum.expectedAmountFrom) || 0,
        }))
      }),
    ])

    // Получаем информацию о клиентах для топ-списка
    const clientIds = topClients.map(c => c.clientId)
    const clients = await prisma.client.findMany({
      where: { id: { in: clientIds } },
      select: { id: true, firstName: true, lastName: true, username: true },
    })
    const clientsMap = new Map(clients.map(c => [c.id, c]))

    // Получаем информацию об офисах для топ-списка
    const officeIds = topOffices.map(o => o.officeId).filter(Boolean) as string[]
    const offices = await prisma.office.findMany({
      where: { id: { in: officeIds } },
      select: { id: true, name: true, city: true },
    })
    const officesMap = new Map(offices.map(o => [o.id, o]))

    // Ждем завершения всех промисов для дневной статистики
    const resolvedDailyStats = await Promise.all(dailyStats)

    // Рассчитываем производные метрики
    const conversionRate = totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0
    const cancelationRate = totalRequests > 0 ? (canceledRequests / totalRequests) * 100 : 0

    // Формируем ответ
    const reportData = {
      period: {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        label: filters.period,
      },
      summary: {
        totalRequests,
        completedRequests,
        canceledRequests,
        inProgressRequests: totalRequests - completedRequests - canceledRequests,
        totalVolume: Number(totalVolume._sum.expectedAmountFrom) || 0,
        conversionRate: Math.round(conversionRate * 100) / 100,
        cancelationRate: Math.round(cancelationRate * 100) / 100,
      },
      statusDistribution: statusStats.map(stat => ({
        status: stat.status,
        count: stat._count.id,
        percentage: totalRequests > 0 ? Math.round((stat._count.id / totalRequests) * 100) : 0,
      })),
      directionDistribution: directionStats.map(stat => ({
        direction: stat.direction,
        count: stat._count.id,
        percentage: totalRequests > 0 ? Math.round((stat._count.id / totalRequests) * 100) : 0,
      })),
      topClients: topClients.map(stat => ({
        client: clientsMap.get(stat.clientId),
        requestsCount: stat._count.id,
      })),
      topOffices: topOffices.map(stat => ({
        office: officesMap.get(stat.officeId!),
        requestsCount: stat._count.id,
      })),
      dailyTrend: resolvedDailyStats,
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: reportData,
    })

  } catch (error) {
    console.error('Overview report error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}