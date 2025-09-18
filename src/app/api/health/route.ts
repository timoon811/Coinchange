import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { CacheService, ExchangeRateCache } from '@/lib/cache'
import { RateLimit } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { RequestStatus } from '@prisma/client'

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  uptime: number
  version: string
  checks: {
    database: HealthCheck
    cache: HealthCheck
    rateLimit: HealthCheck
    logging: HealthCheck
  }
  metrics: {
    requests: {
      total: number
      active: number
    }
    users: number
    offices: number
    memoryUsage: NodeJS.MemoryUsage
    environment: string
    nodeVersion: string
  }
  responseTime: number
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded'
  responseTime: number
  details?: any
  error?: string
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Проверяем подключение
    await prisma.$queryRaw`SELECT 1 as connection_test`
    
    // Проверяем основные таблицы с подсчетом
    const [userCount, requestCount, officeCount] = await Promise.all([
      prisma.user.count(),
      prisma.request.count(),
      prisma.office.count()
    ])
    
    const responseTime = Date.now() - startTime
    
    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      details: {
        userCount,
        requestCount,
        officeCount,
        connected: true,
        tablesAccessible: true
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Database connection failed',
      details: {
        connected: false,
        tablesAccessible: false
      }
    }
  }
}

async function checkCache(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Тестируем операции с кешем
    const testKey = 'health_check_test'
    const testValue = { timestamp: Date.now() }
    
    CacheService.set(testKey, testValue, 1000) // TTL 1 секунда
    const cachedValue = CacheService.get(testKey)
    CacheService.delete(testKey)
    
    const isWorking = cachedValue && cachedValue.timestamp === testValue.timestamp
    
    // Получаем статистику кеша
    const cacheStats = CacheService.getStats()
    const exchangeRateStats = ExchangeRateCache.getStats()
    
    const responseTime = Date.now() - startTime
    
    return {
      status: isWorking ? 'healthy' : 'unhealthy',
      responseTime,
      details: {
        working: isWorking,
        mainCache: cacheStats,
        exchangeRateCache: exchangeRateStats,
        testPassed: isWorking
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Cache check failed',
      details: {
        working: false,
        testPassed: false
      }
    }
  }
}

async function checkRateLimit(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Получаем статистику rate limiting
    const stats = RateLimit.getStats()
    const blockedIPs = RateLimit.getBlockedIPs()
    
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        ...stats,
        blockedIPs: blockedIPs.length,
        activeBlocks: blockedIPs.filter(b => b.remaining > 0).length,
        working: true
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Rate limit check failed',
      details: {
        working: false
      }
    }
  }
}

async function checkLogging(): Promise<HealthCheck> {
  const startTime = Date.now()
  
  try {
    // Тестируем логирование
    const testMessage = `Health check test - ${Date.now()}`
    logger.debug(testMessage)
    
    const responseTime = Date.now() - startTime
    
    return {
      status: 'healthy',
      responseTime,
      details: {
        logLevel: process.env.LOG_LEVEL || 'info',
        working: true,
        testPassed: true
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Logging check failed',
      details: {
        working: false,
        testPassed: false
      }
    }
  }
}

function getOverallStatus(checks: Record<string, HealthCheck>): 'healthy' | 'unhealthy' | 'degraded' {
  const statuses = Object.values(checks).map(check => check.status)
  
  if (statuses.some(status => status === 'unhealthy')) {
    return 'unhealthy'
  }
  
  if (statuses.some(status => status === 'degraded')) {
    return 'degraded'
  }
  
  return 'healthy'
}

export async function GET() {
  const overallStartTime = Date.now()
  
  try {
    // Выполняем все проверки параллельно
    const [databaseCheck, cacheCheck, rateLimitCheck, loggingCheck] = await Promise.all([
      checkDatabase(),
      checkCache(),
      checkRateLimit(),
      checkLogging()
    ])
    
    // Собираем основные метрики
    const [totalRequests, activeRequests, totalUsers, totalOffices] = await Promise.all([
      prisma.request.count(),
      prisma.request.count({
        where: {
          status: {
            in: [RequestStatus.NEW, RequestStatus.ASSIGNED, RequestStatus.IN_PROGRESS, RequestStatus.AWAITING_CLIENT, RequestStatus.AWAITING_CONFIRMATION]
          }
        }
      }),
      prisma.user.count(),
      prisma.office.count({ where: { isActive: true } })
    ])
    
    const checks = {
      database: databaseCheck,
      cache: cacheCheck,
      rateLimit: rateLimitCheck,
      logging: loggingCheck
    }
    
    const overallStatus = getOverallStatus(checks)
    const responseTime = Date.now() - overallStartTime
    
    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      responseTime,
      checks,
      metrics: {
        requests: {
          total: totalRequests,
          active: activeRequests
        },
        users: totalUsers,
        offices: totalOffices,
        memoryUsage: process.memoryUsage(),
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version
      }
    }
    
    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503
    
    // Логируем результаты health check
    if (overallStatus !== 'healthy') {
      logger.warn('Health check failed or degraded', {
        status: overallStatus,
        failedChecks: Object.fromEntries(
          Object.entries(checks).filter(([, check]) => check.status !== 'healthy')
        ),
        duration: responseTime
      })
    } else {
      logger.debug('Health check completed successfully', {
        status: overallStatus,
        duration: responseTime
      })
    }
    
    return NextResponse.json(result, { 
      status: statusCode,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    const responseTime = Date.now() - overallStartTime
    
    logger.error('Health check error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: responseTime
    })
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Health check failed',
      uptime: process.uptime(),
      responseTime,
      checks: {
        database: { status: 'unknown', responseTime: 0 },
        cache: { status: 'unknown', responseTime: 0 },
        rateLimit: { status: 'unknown', responseTime: 0 },
        logging: { status: 'unknown', responseTime: 0 }
      }
    }, { status: 503 })
  }
}