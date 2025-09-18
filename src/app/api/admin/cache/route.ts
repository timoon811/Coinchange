import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'
import { CacheService, ExchangeRateCache } from '@/lib/cache'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { z } from 'zod'

interface CacheStats {
  main: {
    size: number
    keys: string[]
    stats: any
  }
  exchangeRates: {
    total: number
    fresh: number
    stale: number
    popular: number
    cachedRates: Array<{
      pair: string
      rate: number
      age: number
    }>
  }
  operations: {
    totalHits: number
    totalMisses: number
    hitRate: number
  }
}

// Схема валидации для операций с кешем
const cacheOperationSchema = z.object({
  action: z.enum(['clear', 'delete', 'warmup', 'invalidate']),
  target: z.enum(['all', 'main', 'exchange-rates']).optional(),
  key: z.string().optional(),
  keys: z.array(z.string()).optional(),
  currencies: z.array(z.string()).optional(),
})

// GET /api/admin/cache - Получить статистику кеша
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

    // Собираем статистику кеша
    const mainCacheStats = CacheService.getStats()
    const exchangeRateStats = ExchangeRateCache.getStats()
    const cachedRates = ExchangeRateCache.getCachedRates()

    const cacheStats: CacheStats = {
      main: {
        size: mainCacheStats.size,
        keys: mainCacheStats.keys,
        stats: mainCacheStats
      },
      exchangeRates: {
        ...exchangeRateStats,
        cachedRates
      },
      operations: {
        totalHits: 0, // Эти метрики можно добавить в CacheService
        totalMisses: 0,
        hitRate: 0
      }
    }

    return NextResponse.json<ApiResponse<CacheStats>>({
      success: true,
      data: cacheStats,
      message: 'Статистика кеша получена'
    })

  } catch (error) {
    console.error('Cache stats error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/cache - Управление кешем
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

    // Парсим и валидируем данные
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Неверный формат JSON' },
        { status: 400 }
      )
    }

    const validationResult = cacheOperationSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные параметры операции',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const { action, target = 'all', key, keys, currencies } = validationResult.data

    let result: any = {}

    switch (action) {
      case 'clear':
        // Очистка кеша
        if (target === 'all' || target === 'main') {
          CacheService.clear()
          result.mainCacheCleared = true
        }
        
        if (target === 'all' || target === 'exchange-rates') {
          ExchangeRateCache.invalidateRates()
          result.exchangeRatesCacheCleared = true
        }
        
        result.message = `Кеш ${target} очищен`
        break

      case 'delete':
        // Удаление конкретных ключей
        if (key) {
          CacheService.delete(key)
          result.deletedKey = key
        }
        
        if (keys && keys.length > 0) {
          keys.forEach(k => CacheService.delete(k))
          result.deletedKeys = keys
        }
        
        result.message = 'Указанные ключи удалены из кеша'
        break

      case 'invalidate':
        // Инвалидация курсов валют
        if (currencies && currencies.length > 0) {
          ExchangeRateCache.invalidateRates(currencies)
          result.invalidatedCurrencies = currencies
        } else {
          ExchangeRateCache.invalidateRates()
          result.invalidatedAll = true
        }
        
        result.message = 'Курсы валют инвалидированы'
        break

      case 'warmup':
        // Предварительный прогрев кеша
        try {
          await ExchangeRateCache.preloadPopularRates()
          result.warmupCompleted = true
          result.message = 'Кеш курсов валют прогрет'
        } catch (error) {
          result.warmupFailed = true
          result.error = error instanceof Error ? error.message : 'Ошибка прогрева'
        }
        break

      default:
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Неподдерживаемая операция' },
          { status: 400 }
        )
    }

    // Логируем операцию
    console.log('Cache operation performed', {
      action,
      target,
      userId: payload.userId,
      result,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: result.message || 'Операция выполнена'
    })

  } catch (error) {
    console.error('Cache operation error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/cache - Полная очистка кеша
export async function DELETE(request: NextRequest) {
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

    // Получаем статистику до очистки
    const statsBeforeClear = {
      mainCacheSize: CacheService.getStats().size,
      exchangeRatesStats: ExchangeRateCache.getStats()
    }

    // Очищаем все кеши
    CacheService.clear()
    ExchangeRateCache.invalidateRates()

    // Логируем операцию
    console.log('Full cache clear performed', {
      userId: payload.userId,
      statsBeforeClear,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        cleared: true,
        statsBeforeClear
      },
      message: 'Весь кеш очищен'
    })

  } catch (error) {
    console.error('Cache clear error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
