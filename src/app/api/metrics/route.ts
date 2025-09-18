import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { CacheService, ExchangeRateCache } from '@/lib/cache'
import { RateLimit } from '@/lib/rate-limit'
import { UserRole, RequestStatus } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { startOfHour, subHours, format } from 'date-fns'

interface SystemMetrics {
  timestamp: string
  system: {
    uptime: number
    memory: NodeJS.MemoryUsage
    cpu: {
      loadAverage: number[]
      usage: number
    }
    environment: string
    version: string
  }
  database: {
    connectionPool: {
      active: number
      idle: number
      total: number
    }
    queries: {
      total: number
      slow: number
      errors: number
    }
    tables: {
      users: number
      requests: number
      clients: number
      offices: number
    }
  }
  cache: {
    main: {
      size: number
      hitRate: number
      keys: number
    }
    exchangeRates: {
      total: number
      fresh: number
      stale: number
      popular: number
    }
  }
  rateLimit: {
    totalEntries: number
    activeEntries: number
    totalBlocks: number
    activeBlocks: number
  }
  api: {
    requestsPerHour: Array<{
      hour: string
      requests: number
      errors: number
      avgResponseTime: number
    }>
    endpoints: Array<{
      path: string
      method: string
      requests: number
      avgResponseTime: number
      errorRate: number
    }>
    statusCodes: Record<string, number>
  }
  business: {
    activeRequests: number
    completedToday: number
    totalVolume: number
    activeUsers: number
  }
}

// Имитация метрик CPU (в реальном приложении используйте системные метрики)
function getCPUUsage(): number {
  const usage = process.cpuUsage()
  const total = usage.user + usage.system
  return Math.round((total / 1000000) * 100) / 100 // Конвертируем в проценты
}

// Имитация метрик API (в реальном приложении собирайте из логов)
function getApiMetrics(): SystemMetrics['api'] {
  const now = new Date()
  const requestsPerHour = []
  
  // Генерируем данные за последние 24 часа
  for (let i = 23; i >= 0; i--) {
    const hour = subHours(now, i)
    requestsPerHour.push({
      hour: format(hour, 'yyyy-MM-dd HH:00'),
      requests: Math.floor(Math.random() * 100) + 50,
      errors: Math.floor(Math.random() * 5),
      avgResponseTime: Math.floor(Math.random() * 200) + 100,
    })
  }

  return {
    requestsPerHour,
    endpoints: [
      { path: '/api/requests', method: 'GET', requests: 1250, avgResponseTime: 145, errorRate: 2.1 },
      { path: '/api/dashboard/stats', method: 'GET', requests: 890, avgResponseTime: 280, errorRate: 1.2 },
      { path: '/api/auth/login', method: 'POST', requests: 567, avgResponseTime: 320, errorRate: 8.5 },
      { path: '/api/clients', method: 'GET', requests: 445, avgResponseTime: 167, errorRate: 0.9 },
      { path: '/api/exchange-rates', method: 'GET', requests: 234, avgResponseTime: 89, errorRate: 0.5 },
    ],
    statusCodes: {
      '200': 8924,
      '201': 456,
      '400': 234,
      '401': 123,
      '403': 45,
      '404': 67,
      '429': 23,
      '500': 12,
    }
  }
}

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

    // Проверяем права администратора
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    const startTime = Date.now()

    // Собираем метрики параллельно
    const [
      // Database metrics
      userCount,
      requestCount,
      clientCount,
      officeCount,
      activeRequests,
      completedToday,
      totalVolume,
      
      // Cache metrics
      cacheStats,
      exchangeRateStats,
      
      // Rate limit metrics
      rateLimitStats,
    ] = await Promise.all([
      // Database queries
      prisma.user.count(),
      prisma.request.count(),
      prisma.client.count(),
      prisma.office.count(),
      prisma.request.count({
        where: {
          status: {
            in: [RequestStatus.NEW, RequestStatus.ASSIGNED, RequestStatus.IN_PROGRESS]
          }
        }
      }),
      prisma.request.count({
        where: {
          status: RequestStatus.COMPLETED,
          completedAt: {
            gte: startOfHour(new Date())
          }
        }
      }),
      prisma.requestFinance.aggregate({
        _sum: {
          expectedAmountFrom: true
        },
        where: {
          request: {
            createdAt: {
              gte: startOfHour(new Date())
            }
          }
        }
      }),
      
      // Cache and other metrics
      Promise.resolve(CacheService.getStats()),
      Promise.resolve(ExchangeRateCache.getStats()),
      Promise.resolve(RateLimit.getStats()),
    ])

    // Подсчитываем активных пользователей (пользователи с активностью за последний час)
    const activeUsers = await prisma.auditLog.groupBy({
      by: ['actorId'],
      where: {
        timestamp: {
          gte: subHours(new Date(), 1)
        }
      },
      _count: {
        actorId: true
      }
    })

    const metrics: SystemMetrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: {
          loadAverage: [0, 0, 0], // В Node.js недоступно, нужна системная библиотека
          usage: getCPUUsage()
        },
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      },
      database: {
        connectionPool: {
          active: 10, // Примерные значения, в реальности нужно получать из Prisma
          idle: 5,
          total: 15
        },
        queries: {
          total: 1000, // Примерные значения
          slow: 15,
          errors: 2
        },
        tables: {
          users: userCount,
          requests: requestCount,
          clients: clientCount,
          offices: officeCount
        }
      },
      cache: {
        main: {
          size: cacheStats.size,
          hitRate: 85.5, // Примерное значение
          keys: cacheStats.keys.length
        },
        exchangeRates: exchangeRateStats
      },
      rateLimit: rateLimitStats,
      api: getApiMetrics(),
      business: {
        activeRequests,
        completedToday,
        totalVolume: Number(totalVolume._sum.expectedAmountFrom) || 0,
        activeUsers: activeUsers.length
      }
    }

    const responseTime = Date.now() - startTime

    return NextResponse.json<ApiResponse<SystemMetrics>>({
      success: true,
      data: metrics,
      message: `Метрики собраны за ${responseTime}мс`
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Collection-Time': responseTime.toString()
      }
    })

  } catch (error) {
    console.error('Metrics collection error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера при сборе метрик' },
      { status: 500 }
    )
  }
}

// POST endpoint для записи кастомных метрик
export async function POST(request: NextRequest) {
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

    // Проверяем права администратора
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    const body = await request.json()
    
    // Валидация кастомных метрик
    const { metric, value, tags = {} } = body
    
    if (!metric || typeof metric !== 'string') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Поле metric обязательно и должно быть строкой' },
        { status: 400 }
      )
    }
    
    if (value === undefined || typeof value !== 'number') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Поле value обязательно и должно быть числом' },
        { status: 400 }
      )
    }

    // Сохраняем кастомную метрику (в реальном приложении отправляйте в систему мониторинга)
    console.log('Custom metric recorded:', {
      metric,
      value,
      tags,
      timestamp: new Date().toISOString(),
      userId: payload.userId
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Кастомная метрика записана'
    })

  } catch (error) {
    console.error('Custom metric error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера при записи метрики' },
      { status: 500 }
    )
  }
}
