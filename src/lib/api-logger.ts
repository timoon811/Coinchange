import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'

interface RequestLogData {
  method: string
  url: string
  path: string
  userAgent?: string
  ip: string
  userId?: string
  userRole?: string
  requestSize: number
  timestamp: string
}

interface ResponseLogData extends RequestLogData {
  statusCode: number
  responseTime: number
  responseSize?: number
  success: boolean
  error?: string
}

/**
 * Middleware для логирования API запросов
 */
export class ApiLogger {
  private static getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const clientIP = request.headers.get('x-client-ip')

    return forwarded?.split(',')[0]?.trim() ||
           realIP ||
           clientIP ||
           request.ip ||
           'unknown'
  }

  private static getRequestSize(request: NextRequest): number {
    const contentLength = request.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : 0
  }

  private static getResponseSize(response: NextResponse): number {
    const contentLength = response.headers.get('content-length')
    return contentLength ? parseInt(contentLength, 10) : 0
  }

  private static shouldLogRequest(path: string): boolean {
    // Не логируем статические файлы и некоторые служебные endpoints
    const skipPaths = [
      '/_next/',
      '/favicon.ico',
      '/api/health',
      '/api/metrics'
    ]

    return !skipPaths.some(skipPath => path.startsWith(skipPath))
  }

  /**
   * Логирует входящий запрос
   */
  static logRequest(request: NextRequest): RequestLogData {
    const { pathname } = new URL(request.url)
    
    const logData: RequestLogData = {
      method: request.method,
      url: request.url,
      path: pathname,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: this.getClientIP(request),
      userId: request.headers.get('x-user-id') || undefined,
      userRole: request.headers.get('x-user-role') || undefined,
      requestSize: this.getRequestSize(request),
      timestamp: new Date().toISOString(),
    }

    if (this.shouldLogRequest(pathname)) {
      logger.apiRequest(
        logData.method,
        logData.path,
        0, // статус код пока неизвестен
        undefined,
        {
          type: 'request',
          userAgent: logData.userAgent,
          ip: logData.ip,
          userId: logData.userId,
          userRole: logData.userRole,
          requestSize: logData.requestSize,
        }
      )
    }

    return logData
  }

  /**
   * Логирует ответ сервера
   */
  static logResponse(
    requestData: RequestLogData,
    response: NextResponse,
    startTime: number,
    error?: Error
  ): void {
    const responseTime = Date.now() - startTime
    const statusCode = response.status

    const responseLogData: ResponseLogData = {
      ...requestData,
      statusCode,
      responseTime,
      responseSize: this.getResponseSize(response),
      success: statusCode >= 200 && statusCode < 400,
      error: error?.message,
    }

    if (this.shouldLogRequest(requestData.path)) {
      const logLevel = this.getLogLevel(statusCode, responseTime)
      
      if (error) {
        logger.error(`API ${requestData.method} ${requestData.path}`, {
          ...responseLogData,
          type: 'response',
          error: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        })
      } else {
        logger[logLevel](`API ${requestData.method} ${requestData.path}`, {
          ...responseLogData,
          type: 'response',
        })
      }

      // Логируем медленные запросы отдельно
      if (responseTime > 5000) {
        logger.performance(
          `Slow API request: ${requestData.method} ${requestData.path}`,
          responseTime,
          {
            statusCode,
            ip: requestData.ip,
            userId: requestData.userId,
            userAgent: requestData.userAgent,
          }
        )
      }

      // Логируем ошибки безопасности
      if (statusCode === 401 || statusCode === 403) {
        logger.security('API_ACCESS_DENIED', {
          method: requestData.method,
          path: requestData.path,
          statusCode,
          ip: requestData.ip,
          userAgent: requestData.userAgent,
          userId: requestData.userId,
          severity: statusCode === 401 ? 'medium' : 'high'
        })
      }

      // Логируем подозрительную активность
      if (statusCode === 429) {
        logger.security('API_RATE_LIMIT_HIT', {
          method: requestData.method,
          path: requestData.path,
          ip: requestData.ip,
          userAgent: requestData.userAgent,
          severity: 'high'
        })
      }
    }
  }

  /**
   * Определяет уровень логирования на основе статуса и времени ответа
   */
  private static getLogLevel(statusCode: number, responseTime: number): 'info' | 'warn' | 'error' {
    if (statusCode >= 500) return 'error'
    if (statusCode >= 400) return 'warn'
    if (responseTime > 3000) return 'warn'
    return 'info'
  }

  /**
   * Создает обертку для API handler'а с автоматическим логированием
   */
  static withLogging<T extends any[]>(
    handler: (...args: T) => Promise<NextResponse>
  ): (...args: T) => Promise<NextResponse> {
    return async (...args: T): Promise<NextResponse> => {
      const request = args[0] as NextRequest
      const startTime = Date.now()
      
      // Логируем запрос
      const requestData = this.logRequest(request)
      
      try {
        // Выполняем оригинальный handler
        const response = await handler(...args)
        
        // Логируем успешный ответ
        this.logResponse(requestData, response, startTime)
        
        return response
      } catch (error) {
        // Создаем error response и логируем ошибку
        const errorResponse = NextResponse.json(
          {
            success: false,
            error: 'Internal Server Error',
            message: 'Произошла внутренняя ошибка сервера'
          },
          { status: 500 }
        )
        
        this.logResponse(requestData, errorResponse, startTime, error as Error)
        
        return errorResponse
      }
    }
  }

  /**
   * Получает статистику API запросов за период
   */
  static getApiStats(hours: number = 24): Promise<{
    totalRequests: number
    errorRate: number
    averageResponseTime: number
    topEndpoints: Array<{
      path: string
      count: number
      averageTime: number
    }>
    statusCodeDistribution: Record<string, number>
  }> {
    // Эта функция может быть реализована через анализ логов
    // или через отдельную систему метрик
    return Promise.resolve({
      totalRequests: 0,
      errorRate: 0,
      averageResponseTime: 0,
      topEndpoints: [],
      statusCodeDistribution: {},
    })
  }
}

/**
 * Утилита для создания стандартизированного API ответа с логированием
 */
export function createApiResponse<T = any>(
  data: T,
  options: {
    message?: string
    status?: number
    success?: boolean
    headers?: Record<string, string>
  } = {}
): NextResponse {
  const {
    message,
    status = 200,
    success = status >= 200 && status < 400,
    headers = {}
  } = options

  const response = NextResponse.json(
    {
      success,
      data,
      message,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': '1.0',
        'X-Response-Time': Date.now().toString(),
        ...headers,
      },
    }
  )

  return response
}

/**
 * Утилита для создания стандартизированного API error ответа
 */
export function createApiErrorResponse(
  error: string | Error,
  options: {
    status?: number
    details?: any
    code?: string
  } = {}
): NextResponse {
  const {
    status = 500,
    details,
    code
  } = options

  const errorMessage = error instanceof Error ? error.message : error

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      code,
      details,
      timestamp: new Date().toISOString(),
    },
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Version': '1.0',
      },
    }
  )
}

/**
 * Декоратор для автоматического применения логирования к API routes
 */
export function withApiLogging(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value

  descriptor.value = ApiLogger.withLogging(originalMethod)

  return descriptor
}
