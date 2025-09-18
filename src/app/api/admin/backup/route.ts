import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'
import { DatabaseBackup } from '@/lib/database-backup'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { z } from 'zod'

// Схема валидации для операций с бэкапами
const backupOperationSchema = z.object({
  action: z.enum(['create_full', 'create_schema', 'create_tables', 'list', 'verify', 'cleanup', 'configure']),
  tables: z.array(z.string()).optional(),
  backupFilePath: z.string().optional(),
  config: z.object({
    maxBackups: z.number().int().min(1).max(100).optional(),
    compressionEnabled: z.boolean().optional(),
    scheduleEnabled: z.boolean().optional(),
    scheduleHour: z.number().int().min(0).max(23).optional(),
    excludedTables: z.array(z.string()).optional(),
  }).optional(),
})

// GET /api/admin/backup - Получить список бэкапов и статистику
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

    // Получаем список бэкапов и статистику
    const [backupsList, backupStats] = await Promise.all([
      DatabaseBackup.getBackupsList(),
      DatabaseBackup.getBackupStats()
    ])

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        backups: backupsList,
        stats: backupStats,
        recommendations: {
          shouldCreateBackup: backupsList.length === 0 || 
            (backupStats.newestBackup && 
             Date.now() - backupStats.newestBackup.getTime() > 24 * 60 * 60 * 1000),
          suggestions: [
            backupsList.length === 0 ? 'Рекомендуется создать первый бэкап' : null,
            backupStats.totalSizeMB > 1000 ? 'Размер бэкапов превышает 1GB, рассмотрите очистку старых файлов' : null,
            !backupStats.nextScheduledBackup ? 'Автоматические бэкапы отключены' : null,
          ].filter(Boolean)
        }
      },
      message: 'Список бэкапов получен'
    })

  } catch (error) {
    console.error('Backup list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/backup - Выполнить операции с бэкапами
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

    const validationResult = backupOperationSchema.safeParse(body)
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

    const { action, tables, backupFilePath, config } = validationResult.data

    let result: any = {}

    switch (action) {
      case 'create_full':
        // Создание полного бэкапа
        try {
          const backupResult = await DatabaseBackup.createFullBackup()
          result = {
            backupCreated: backupResult.success,
            ...backupResult
          }
          
          console.log('Full backup created by admin', {
            userId: payload.userId,
            result: backupResult,
            timestamp: new Date().toISOString()
          })
          
        } catch (error) {
          result = {
            backupCreated: false,
            error: error instanceof Error ? error.message : 'Ошибка создания бэкапа'
          }
        }
        break

      case 'create_schema':
        // Создание бэкапа схемы
        try {
          const backupResult = await DatabaseBackup.createSchemaBackup()
          result = {
            schemaBackupCreated: backupResult.success,
            ...backupResult
          }
          
          console.log('Schema backup created by admin', {
            userId: payload.userId,
            result: backupResult,
            timestamp: new Date().toISOString()
          })
          
        } catch (error) {
          result = {
            schemaBackupCreated: false,
            error: error instanceof Error ? error.message : 'Ошибка создания бэкапа схемы'
          }
        }
        break

      case 'create_tables':
        // Создание бэкапа таблиц
        if (!tables || tables.length === 0) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Не указаны таблицы для бэкапа' },
            { status: 400 }
          )
        }

        try {
          const backupResult = await DatabaseBackup.createTableBackup(tables)
          result = {
            tableBackupCreated: backupResult.success,
            tables,
            ...backupResult
          }
          
          console.log('Table backup created by admin', {
            userId: payload.userId,
            tables,
            result: backupResult,
            timestamp: new Date().toISOString()
          })
          
        } catch (error) {
          result = {
            tableBackupCreated: false,
            error: error instanceof Error ? error.message : 'Ошибка создания бэкапа таблиц'
          }
        }
        break

      case 'list':
        // Получение списка бэкапов
        result = {
          backups: await DatabaseBackup.getBackupsList(),
          stats: await DatabaseBackup.getBackupStats()
        }
        break

      case 'verify':
        // Проверка целостности бэкапа
        if (!backupFilePath) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Не указан путь к файлу бэкапа' },
            { status: 400 }
          )
        }

        try {
          const isValid = await DatabaseBackup.verifyBackup(backupFilePath)
          result = {
            verified: true,
            valid: isValid,
            backupFilePath
          }
        } catch (error) {
          result = {
            verified: false,
            error: error instanceof Error ? error.message : 'Ошибка проверки бэкапа'
          }
        }
        break

      case 'cleanup':
        // Очистка старых бэкапов
        try {
          const deletedCount = await DatabaseBackup.cleanupOldBackups()
          result = {
            cleanupCompleted: true,
            deletedBackups: deletedCount
          }
          
          console.log('Backup cleanup performed by admin', {
            userId: payload.userId,
            deletedCount,
            timestamp: new Date().toISOString()
          })
          
        } catch (error) {
          result = {
            cleanupCompleted: false,
            error: error instanceof Error ? error.message : 'Ошибка очистки бэкапов'
          }
        }
        break

      case 'configure':
        // Настройка конфигурации бэкапов
        if (config) {
          DatabaseBackup.configure(config)
          result = {
            configurationUpdated: true,
            newConfig: config
          }
          
          console.log('Backup configuration updated by admin', {
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
      message: result.backupCreated ? 'Бэкап создан' :
               result.schemaBackupCreated ? 'Бэкап схемы создан' :
               result.tableBackupCreated ? 'Бэкап таблиц создан' :
               result.cleanupCompleted ? 'Очистка завершена' :
               result.configurationUpdated ? 'Конфигурация обновлена' :
               'Операция выполнена'
    })

  } catch (error) {
    console.error('Backup operation error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
