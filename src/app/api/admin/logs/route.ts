import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'
import { LogCleaner } from '@/lib/log-cleaner'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { z } from 'zod'

// Схема валидации для операций с логами
const logOperationSchema = z.object({
  action: z.enum(['cleanup', 'stats', 'configure']),
  config: z.object({
    maxAgeInDays: z.number().int().min(1).max(365).optional(),
    maxSizeInMB: z.number().int().min(1).max(10000).optional(),
    maxFiles: z.number().int().min(1).max(1000).optional(),
    compressionEnabled: z.boolean().optional(),
    archiveOldLogs: z.boolean().optional(),
  }).optional(),
})

// GET /api/admin/logs - Получить статистику логов
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

    // Получаем статистику логов
    const logStats = await LogCleaner.getLogStats()
    const shouldCleanup = await LogCleaner.shouldCleanup()

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...logStats,
        shouldCleanup,
        recommendations: {
          cleanupNeeded: shouldCleanup,
          suggestions: shouldCleanup ? [
            'Рекомендуется выполнить очистку логов',
            logStats.totalSizeMB > 100 ? 'Размер логов превышает рекомендуемый лимит' : null,
            logStats.totalFiles > 50 ? 'Количество файлов превышает рекомендуемый лимит' : null,
          ].filter(Boolean) : ['Состояние логов в норме']
        }
      },
      message: 'Статистика логов получена'
    })

  } catch (error) {
    console.error('Log stats error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/logs - Управление логами
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

    const validationResult = logOperationSchema.safeParse(body)
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

    const { action, config } = validationResult.data

    let result: any = {}

    switch (action) {
      case 'cleanup':
        // Запуск очистки логов
        try {
          const cleanupResult = await LogCleaner.cleanup()
          result = {
            cleanupCompleted: true,
            ...cleanupResult
          }
          
          // Логируем операцию очистки
          console.log('Manual log cleanup performed', {
            userId: payload.userId,
            result: cleanupResult,
            timestamp: new Date().toISOString()
          })
          
        } catch (error) {
          result = {
            cleanupFailed: true,
            error: error instanceof Error ? error.message : 'Ошибка очистки логов'
          }
        }
        break

      case 'stats':
        // Получение детальной статистики
        result = await LogCleaner.getLogStats()
        break

      case 'configure':
        // Настройка конфигурации очистки
        if (config) {
          LogCleaner.configure(config)
          result = {
            configurationUpdated: true,
            newConfig: config
          }
          
          console.log('Log cleaner configuration updated', {
            userId: payload.userId,
            config,
            timestamp: new Date().toISOString()
          })
        } else {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Конфигурация не предоставлена' },
            { status: 400 }
          )
        }
        break

      default:
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Неподдерживаемая операция' },
          { status: 400 }
        )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: result.cleanupCompleted ? 'Очистка логов завершена' : 
               result.configurationUpdated ? 'Конфигурация обновлена' : 
               'Операция выполнена'
    })

  } catch (error) {
    console.error('Log operation error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
