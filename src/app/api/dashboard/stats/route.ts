import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { RequestStatus, OperationDirection, UserRole } from '@prisma/client'
import { startOfDay, endOfDay, subDays, format } from 'date-fns'
import type { AuthenticatedPayload, DashboardStats, ApiResponse } from '@/lib/types'
import { CacheService } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    // Аутентифицируем пользователя
    const { AuthService } = await import('@/lib/auth')
    let payload: AuthenticatedPayload

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role
    const userOffices = payload.officeIds

    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '7d' // 1d, 7d, 30d

    // Определяем временной диапазон
    const now = new Date()
    let startDate: Date

    switch (period) {
      case '1d':
        startDate = startOfDay(now)
        break
      case '7d':
        startDate = subDays(now, 7)
        break
      case '30d':
        startDate = subDays(now, 30)
        break
      default:
        startDate = subDays(now, 7)
    }

    // Базовые условия для фильтрации (учитываем роли)
    let baseWhere: Record<string, unknown> = {
      createdAt: {
        gte: startDate,
        lte: now,
      },
    }

    if (userRole === UserRole.CASHIER && userOffices) {
      baseWhere.officeId = {
        in: userOffices,
      }
    }

    // Создаем ключ для кеширования
    const cacheKey = CacheService.keys.dashboardStats(`${period}_${userId}_${userRole}_${JSON.stringify(userOffices)}`)

    // Пытаемся получить данные из кеша
    const cachedData = CacheService.get<DashboardStats>(cacheKey)
    if (cachedData) {
      return NextResponse.json<ApiResponse<DashboardStats>>({
        success: true,
        data: cachedData,
      })
    }

    // 1. Основные KPI
    const [
      totalRequests,
      newRequests,
      inProgressRequests,
      completedRequests,
      overdueRequests,
      totalVolume,
      averageCompletionTime,
    ] = await Promise.all([
      // Общее количество заявок
      prisma.request.count({ where: baseWhere }),

      // Новые заявки
      prisma.request.count({
        where: {
          ...baseWhere,
          status: RequestStatus.NEW,
        },
      }),

      // В работе
      prisma.request.count({
        where: {
          ...baseWhere,
          status: RequestStatus.IN_PROGRESS,
        },
      }),

      // Завершенные
      prisma.request.count({
        where: {
          ...baseWhere,
          status: RequestStatus.COMPLETED,
        },
      }),

      // Просроченные
      prisma.request.count({
        where: {
          ...baseWhere,
          slaDeadline: {
            lt: now,
          },
          status: {
            notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED, RequestStatus.REJECTED],
          },
        },
      }),

      // Общий объем
      prisma.requestFinance.aggregate({
        where: {
          request: baseWhere,
        },
        _sum: {
          expectedAmountFrom: true,
        },
      }),

      // Среднее время выполнения
      prisma.request.findMany({
        where: {
          ...baseWhere,
          status: RequestStatus.COMPLETED,
          completedAt: { not: null },
        },
        select: {
          createdAt: true,
          completedAt: true,
        },
      }).then(requests => {
        if (requests.length === 0) return 0

        const totalTime = requests.reduce((sum, req) => {
          const completionTime = req.completedAt!.getTime() - req.createdAt.getTime()
          return sum + completionTime
        }, 0)

        return totalTime / requests.length / (1000 * 60) // в минутах
      }),
    ])

    // 2. Статистика по статусам
    const statusStats = await prisma.request.groupBy({
      by: ['status'],
      where: baseWhere,
      _count: {
        id: true,
      },
    })

    // 3. Статистика по направлениям
    const directionStats = await prisma.request.groupBy({
      by: ['direction'],
      where: baseWhere,
      _count: {
        id: true,
      },
    })

    // Получаем суммы для направлений - нужно джойнить с заявками
    const directionVolumes = new Map()
    for (const stat of directionStats) {
      const volume = await prisma.requestFinance.aggregate({
        where: {
          request: {
            ...baseWhere,
            direction: stat.direction,
          },
        },
        _sum: {
          expectedAmountFrom: true,
        },
      })
      directionVolumes.set(stat.direction, Number(volume._sum.expectedAmountFrom) || 0)
    }

    // 4. Статистика по валютам
    const currencyStats = await prisma.requestFinance.groupBy({
      by: ['fromCurrency'],
      where: {
        request: baseWhere,
      },
      _count: {
        id: true,
      },
      _sum: {
        expectedAmountFrom: true,
      },
    })

    // 5. Статистика по офисам
    const officeStats = await prisma.request.groupBy({
      by: ['officeId'],
      where: baseWhere,
      _count: {
        id: true,
      },
    })

    // Получаем суммы для офисов - нужно джойнить с заявками
    const officeVolumes = new Map()
    for (const stat of officeStats) {
      if (stat.officeId) {
        const volume = await prisma.requestFinance.aggregate({
          where: {
            request: {
              ...baseWhere,
              officeId: stat.officeId,
            },
          },
          _sum: {
            expectedAmountFrom: true,
          },
        })
        officeVolumes.set(stat.officeId, Number(volume._sum.expectedAmountFrom) || 0)
      }
    }

    // 6. Тренд по дням (для графика)
    const dailyTrend = []
    for (let i = 6; i >= 0; i--) {
      const date = subDays(now, i)
      const dayStart = startOfDay(date)
      const dayEnd = endOfDay(date)

      const dayRequests = await prisma.request.count({
        where: {
          ...baseWhere,
          createdAt: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      })

      const dayVolume = await prisma.requestFinance.aggregate({
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
      })

      dailyTrend.push({
        date: format(date, 'yyyy-MM-dd'),
        requests: dayRequests,
        volume: Number(dayVolume._sum.expectedAmountFrom) || 0,
      })
    }

    // 7. Недавние заявки
    const recentRequests = await prisma.request.findMany({
      where: baseWhere,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        office: {
          select: {
            name: true,
          },
        },
        finance: {
          select: {
            fromCurrency: true,
            toCurrency: true,
            expectedAmountFrom: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 5,
    })

    // 8. Активные кассиры
    const activeCashiers = await prisma.user.count({
      where: {
        role: UserRole.CASHIER,
        isActive: true,
        officeIds: userRole === UserRole.CASHIER ? { hasSome: userOffices } : undefined,
      },
    })

    return NextResponse.json<ApiResponse<DashboardStats>>({
      success: true,
      data: {
        kpi: {
          totalRequests,
          newRequests,
          inProgressRequests,
          completedRequests,
          overdueRequests,
          totalVolume: Number(totalVolume._sum.expectedAmountFrom) || 0,
          averageCompletionTime: Math.round(averageCompletionTime),
          conversionRate: totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0,
        },
        statusStats: statusStats.map(stat => ({
          status: stat.status,
          count: stat._count.id,
        })),
        directionStats: directionStats.map(stat => ({
          direction: stat.direction,
          count: stat._count.id,
          volume: directionVolumes.get(stat.direction) || 0,
        })),
        currencyStats: currencyStats.map(stat => ({
          currency: stat.fromCurrency,
          count: stat._count.id,
          volume: Number(stat._sum.expectedAmountFrom) || 0,
        })),
        officeStats: officeStats.map(stat => ({
          officeId: stat.officeId || 'unknown',
          count: stat._count.id,
          volume: officeVolumes.get(stat.officeId) || 0,
        })),
        dailyTrend,
        recentRequests: recentRequests.map(req => ({
          id: req.id,
          requestId: req.requestId,
          client: req.client,
          direction: req.direction,
          amount: Number(req.finance?.expectedAmountFrom) || 0,
          currency: req.finance?.fromCurrency || '',
          office: req.office?.name || '',
          status: req.status,
          createdAt: req.createdAt.toISOString(),
        })),
        activeCashiers,
        period,
      },
    })

    // Получаем данные для кеширования
    const statsData = {
      kpi,
      statusStats,
      directionStats,
      currencyStats,
      officeStats,
      dailyTrend,
      recentRequests: recentRequests.map(req => ({
        id: req.id,
        requestId: req.requestId,
        client: req.client,
        direction: req.direction,
        amount: Number(req.finance?.expectedAmountFrom) || 0,
        currency: req.finance?.fromCurrency || '',
        office: req.office?.name || '',
        status: req.status,
        createdAt: req.createdAt.toISOString(),
      })),
      activeCashiers,
      period,
    }

    // Сохраняем результат в кеш на 5 минут
    CacheService.set(cacheKey, statsData, 5 * 60 * 1000)

    return NextResponse.json<ApiResponse<DashboardStats>>({
      success: true,
      data: statsData,
    })

  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
