import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'
import type { RateLimitEntry } from './types'

// In-memory хранилище для rate limiting (в продакшене использовать Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()
const blockedStore = new Map<string, number>() // IP -> время блокировки

// Улучшенные настройки rate limiting
const RATE_LIMIT_CONFIG = {
  // Аутентификация - строгие лимиты
  '/api/auth/login': { 
    windowMs: 15 * 60 * 1000, 
    maxRequests: 5, 
    blockDuration: 60 * 60 * 1000, // блокировка на 1 час
    enableBlocking: true 
  },
  '/api/auth/logout': { 
    windowMs: 60 * 1000, 
    maxRequests: 10,
    blockDuration: 0,
    enableBlocking: false
  },

  // API endpoints для работы с заявками
  '/api/requests': { 
    windowMs: 60 * 1000, 
    maxRequests: 60,
    blockDuration: 5 * 60 * 1000, // блокировка на 5 минут
    enableBlocking: false
  },
  '/api/dashboard': { 
    windowMs: 60 * 1000, 
    maxRequests: 30,
    blockDuration: 0,
    enableBlocking: false
  },

  // Администрирование - умеренные лимиты
  '/api/admin': { 
    windowMs: 60 * 1000, 
    maxRequests: 30,
    blockDuration: 10 * 60 * 1000, // блокировка на 10 минут
    enableBlocking: true
  },

  // Отчеты - ограниченные лимиты
  '/api/reports': { 
    windowMs: 60 * 1000, 
    maxRequests: 10,
    blockDuration: 0,
    enableBlocking: false
  },

  // Telegram webhook - специальные лимиты
  '/api/telegram/webhook': { 
    windowMs: 60 * 1000, 
    maxRequests: 60,
    blockDuration: 0,
    enableBlocking: false
  },

  // Общие правила
  default: { 
    windowMs: 60 * 1000, 
    maxRequests: 100,
    blockDuration: 0,
    enableBlocking: false
  },
}

export class RateLimit {
  private static getClientIP(request: NextRequest): string {
    // Получаем IP адрес клиента с приоритетом заголовков
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const clientIP = request.headers.get('x-client-ip')

    // Приоритет: x-forwarded-for -> x-real-ip -> x-client-ip -> request.ip
    const ip = forwarded?.split(',')[0]?.trim() ||
               realIP ||
               clientIP ||
               request.ip ||
               'unknown'

    return ip
  }

  private static getClientIdentifier(request: NextRequest): string {
    const ip = this.getClientIP(request)
    const userAgent = request.headers.get('user-agent') || 'unknown'
    
    // Создаем короткий хеш от User-Agent для экономии памяти
    const userAgentHash = this.simpleHash(userAgent)
    
    return `${ip}:${userAgentHash}`
  }

  private static simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).substring(0, 8)
  }

  private static getConfigForPath(pathname: string) {
    // Ищем точное совпадение
    if (RATE_LIMIT_CONFIG[pathname as keyof typeof RATE_LIMIT_CONFIG]) {
      return RATE_LIMIT_CONFIG[pathname as keyof typeof RATE_LIMIT_CONFIG]
    }

    // Ищем совпадение по префиксу
    for (const [pattern, config] of Object.entries(RATE_LIMIT_CONFIG)) {
      if (pattern !== 'default' && pathname.startsWith(pattern)) {
        return config
      }
    }

    return RATE_LIMIT_CONFIG.default
  }

  static check(request: NextRequest): { 
    allowed: boolean
    remaining: number
    resetTime: number
    blocked?: boolean
    blockUntil?: number
    retryAfter?: number
  } {
    const clientIdentifier = this.getClientIdentifier(request)
    const clientIP = this.getClientIP(request)
    const pathname = new URL(request.url).pathname
    const config = this.getConfigForPath(pathname)

    const now = Date.now()

    // Проверяем блокировку
    const blockUntil = blockedStore.get(clientIP)
    if (blockUntil && now < blockUntil) {
      const retryAfter = Math.ceil((blockUntil - now) / 1000)
      
      logger.security('RATE_LIMIT_BLOCKED_ACCESS', {
        ip: clientIP,
        pathname,
        blockUntil,
        retryAfter,
        userAgent: request.headers.get('user-agent'),
        severity: 'high'
      })

      return {
        allowed: false,
        remaining: 0,
        resetTime: blockUntil,
        blocked: true,
        blockUntil,
        retryAfter
      }
    }

    const key = `${clientIdentifier}:${pathname}`

    // Получаем или создаем запись
    const entry = rateLimitStore.get(key)

    if (!entry || now > entry.resetTime) {
      // Создаем новую запись
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + config.windowMs,
      }
      rateLimitStore.set(key, newEntry)

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: newEntry.resetTime,
      }
    }

    if (entry.count >= config.maxRequests) {
      // Превышен лимит
      if (config.enableBlocking && config.blockDuration > 0) {
        const blockUntil = now + config.blockDuration
        blockedStore.set(clientIP, blockUntil)
        
        logger.security('RATE_LIMIT_EXCEEDED_BLOCKING', {
          ip: clientIP,
          pathname,
          requestCount: entry.count,
          maxRequests: config.maxRequests,
          blockUntil,
          userAgent: request.headers.get('user-agent'),
          severity: 'high'
        })

        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
          blocked: true,
          blockUntil,
          retryAfter: Math.ceil(config.blockDuration / 1000)
        }
      } else {
        logger.security('RATE_LIMIT_EXCEEDED', {
          ip: clientIP,
          pathname,
          requestCount: entry.count,
          maxRequests: config.maxRequests,
          userAgent: request.headers.get('user-agent'),
          severity: 'medium'
        })

        return {
          allowed: false,
          remaining: 0,
          resetTime: entry.resetTime,
        }
      }
    }

    // Увеличиваем счетчик
    entry.count++
    rateLimitStore.set(key, entry)

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    }
  }

  static createResponse(result: ReturnType<typeof RateLimit.check>): NextResponse {
    const retryAfter = result.retryAfter || Math.ceil((result.resetTime - Date.now()) / 1000)
    
    const errorMessage = result.blocked 
      ? 'IP адрес временно заблокирован из-за превышения лимита запросов'
      : 'Превышен лимит запросов. Попробуйте позже.'

    const response = NextResponse.json(
      {
        error: 'Слишком много запросов',
        message: errorMessage,
        retryAfter,
        blocked: result.blocked || false,
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': '100', // значение по умолчанию
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
        },
      }
    )

    if (result.blocked && result.blockUntil) {
      response.headers.set('X-RateLimit-Blocked-Until', result.blockUntil.toString())
    }

    return response
  }

  // Сброс лимита для конкретного IP/идентификатора
  static reset(request: NextRequest): void {
    const clientIdentifier = this.getClientIdentifier(request)
    const clientIP = this.getClientIP(request)
    const pathname = new URL(request.url).pathname
    
    const key = `${clientIdentifier}:${pathname}`
    rateLimitStore.delete(key)
    blockedStore.delete(clientIP)
    
    logger.info('Rate limit reset', {
      ip: clientIP,
      pathname,
      identifier: clientIdentifier
    })
  }

  // Очистка устаревших записей (можно вызывать периодически)
  static cleanup(): void {
    const now = Date.now()
    let cleanedEntries = 0
    let cleanedBlocks = 0

    // Очищаем rate limit entries
    for (const [key, entry] of rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
        cleanedEntries++
      }
    }

    // Очищаем блокировки
    for (const [ip, blockUntil] of blockedStore.entries()) {
      if (now > blockUntil) {
        blockedStore.delete(ip)
        cleanedBlocks++
      }
    }

    if (cleanedEntries > 0 || cleanedBlocks > 0) {
      logger.debug('Rate limit cleanup completed', {
        cleanedEntries,
        cleanedBlocks,
        remainingEntries: rateLimitStore.size,
        remainingBlocks: blockedStore.size
      })
    }
  }

  // Получение статистики
  static getStats() {
    const now = Date.now()
    let activeEntries = 0
    let activeBlocks = 0

    for (const entry of rateLimitStore.values()) {
      if (now <= entry.resetTime) activeEntries++
    }

    for (const blockUntil of blockedStore.values()) {
      if (now < blockUntil) activeBlocks++
    }

    return {
      totalEntries: rateLimitStore.size,
      activeEntries,
      totalBlocks: blockedStore.size,
      activeBlocks
    }
  }

  // Получение заблокированных IP
  static getBlockedIPs(): Array<{ip: string, blockUntil: number, remaining: number}> {
    const now = Date.now()
    const blocked = []

    for (const [ip, blockUntil] of blockedStore.entries()) {
      if (now < blockUntil) {
        blocked.push({
          ip,
          blockUntil,
          remaining: Math.ceil((blockUntil - now) / 1000)
        })
      }
    }

    return blocked
  }
}

// Запускаем периодическую очистку каждые 5 минут (только на сервере)
if (typeof window === 'undefined') {
  setInterval(() => {
    RateLimit.cleanup()
  }, 5 * 60 * 1000)
}