import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole, RequestStatus, OperationType } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse, ProfitReportData } from '@/lib/types'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'
import { z } from 'zod'

// Схема валидации для параметров отчета
const profitReportSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  period: z.enum(['7d', '30d', '90d', 'month', 'year', 'custom']).default('7d'),
  officeId: z.string().optional(),
})

// GET /api/reports/profit - Получить отчет по прибыли
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

    // Проверяем права администратора (отчеты по прибыли доступны только админам)
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
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

    const validationResult = profitReportSchema.safeParse(params)
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

    // Базовые условия для фильтрации
    let baseWhere: Record<string, unknown> = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    }

    if (filters.officeId) {
      baseWhere.officeId = filters.officeId
    }

    // Собираем данные параллельно
    const [
      // Общий доход от комиссий завершенных операций
      commissionRevenue,
      
      // Количество завершенных операций
      completedOperationsCount,
      
      // Статистика по валютам
      currencyStats,
      
      // Дневная статистика
      dailyStats,
      
      // Операции по категориям (доходы/расходы)
      operationsByCategory,
    ] = await Promise.all([
      // Доход от комиссий завершенных заявок
      prisma.requestFinance.aggregate({
        where: {
          request: {
            ...baseWhere,
            status: RequestStatus.COMPLETED,
          },
        },
        _sum: {
          commissionPercent: true,
          commissionFixed: true,
        },
      }),

      // Количество завершенных операций
      prisma.request.count({
        where: {
          ...baseWhere,
          status: RequestStatus.COMPLETED,
        },
      }),

      // Статистика прибыли по валютам
      prisma.requestFinance.groupBy({
        by: ['fromCurrency'],
        where: {
          request: {
            ...baseWhere,
            status: RequestStatus.COMPLETED,
          },
        },
        _count: {
          id: true,
        },
        _sum: {
          expectedAmountFrom: true,
          commissionPercent: true,
          commissionFixed: true,
        },
      }),

      // Дневная статистика прибыли
      Array.from({ length: 7 }, (_, i) => {
        const date = subDays(endDate, 6 - i)
        const dayStart = startOfDay(date)
        const dayEnd = endOfDay(date)
        
        return Promise.all([
          // Количество завершенных операций за день
          prisma.request.count({
            where: {
              ...baseWhere,
              createdAt: {
                gte: dayStart,
                lte: dayEnd,
              },
              status: RequestStatus.COMPLETED,
            },
          }),
          // Доход от комиссий за день
          prisma.requestFinance.aggregate({
            where: {
              request: {
                ...baseWhere,
                createdAt: {
                  gte: dayStart,
                  lte: dayEnd,
                },
                status: RequestStatus.COMPLETED,
              },
            },
            _sum: {
              expectedAmountFrom: true,
              commissionPercent: true,
              commissionFixed: true,
            },
          }),
        ]).then(([operationsCount, commission]) => ({
          date: format(date, 'yyyy-MM-dd'),
          profit: (Number(commission._sum.commissionPercent) || 0) + 
                 (Number(commission._sum.commissionFixed) || 0),
          volume: Number(commission._sum.expectedAmountFrom) || 0,
          operationsCount,
        }))
      }),

      // Операции по категориям (доходы/расходы)
      prisma.operation.groupBy({
        by: ['type'],
        where: baseWhere,
        _count: {
          id: true,
        },
        _sum: {
          amount: true,
        },
      }),
    ])

    // Ждем завершения всех промисов для дневной статистики
    const resolvedDailyStats = await Promise.all(dailyStats)

    // Рассчитываем основные метрики
    const grossProfit = (Number(commissionRevenue._sum.commissionPercent) || 0) + 
                       (Number(commissionRevenue._sum.commissionFixed) || 0)
    
    // Вычисляем расходы из операций
    const expenses = operationsByCategory
      .filter(op => op.type === OperationType.WITHDRAWAL || op.type === OperationType.ADJUSTMENT)
      .reduce((sum, op) => sum + (Number(op._sum.amount) || 0), 0)
    
    const netProfit = grossProfit - expenses
    const totalVolume = resolvedDailyStats.reduce((sum, day) => sum + day.volume, 0)

    // Формируем топ валют по прибыли
    const topCurrencies = currencyStats
      .map(stat => ({
        currency: stat.fromCurrency,
        profit: (Number(stat._sum.commissionPercent) || 0) + 
               (Number(stat._sum.commissionFixed) || 0),
        volume: Number(stat._sum.expectedAmountFrom) || 0,
        operationsCount: stat._count.id,
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)

    const reportData: ProfitReportData = {
      period: filters.period,
      grossProfit,
      netProfit,
      revenue: grossProfit,
      expenses,
      operationsCount: completedOperationsCount,
      topCurrencies,
      dailyTrend: resolvedDailyStats,
    }

    return NextResponse.json<ApiResponse<ProfitReportData>>({
      success: true,
      data: reportData,
    })

  } catch (error) {
    console.error('Profit report error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}