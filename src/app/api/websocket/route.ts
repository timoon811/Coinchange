import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from '@/lib/auth'
import { getWebSocketServer, NotificationService } from '@/lib/websocket-server'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { z } from 'zod'

// Схема валидации для WebSocket операций
const webSocketOperationSchema = z.object({
  action: z.enum(['broadcast', 'notify_user', 'notify_role', 'notify_office', 'get_stats', 'test_connection']),
  event: z.string().optional(),
  data: z.any().optional(),
  targetUserId: z.string().optional(),
  targetRole: z.nativeEnum(UserRole).optional(),
  targetOfficeId: z.string().optional(),
  message: z.string().optional(),
  severity: z.enum(['info', 'warning', 'error']).optional(),
})

// GET /api/websocket - Получить статистику подключений
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

    // Проверяем права доступа (админ или менеджер)
    if (payload.role !== UserRole.ADMIN && payload.role !== UserRole.MANAGER) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    const wsServer = getWebSocketServer()
    if (!wsServer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'WebSocket сервер не инициализирован' },
        { status: 503 }
      )
    }

    const stats = NotificationService.getConnectionStats()
    
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...stats,
        serverStatus: 'running',
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
      },
      message: 'Статистика WebSocket подключений получена'
    })

  } catch (error) {
    console.error('WebSocket stats error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/websocket - Выполнить WebSocket операции
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

    const validationResult = webSocketOperationSchema.safeParse(body)
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

    const { action, event, data, targetUserId, targetRole, targetOfficeId, message, severity } = validationResult.data

    const wsServer = getWebSocketServer()
    if (!wsServer) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'WebSocket сервер не инициализирован' },
        { status: 503 }
      )
    }

    let result: any = {}

    switch (action) {
      case 'broadcast':
        // Глобальная рассылка всем подключенным пользователям
        if (!event) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Не указано событие для рассылки' },
            { status: 400 }
          )
        }

        // Проверяем права для глобальной рассылки
        if (payload.role !== UserRole.ADMIN) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Только администраторы могут выполнять глобальную рассылку' },
            { status: 403 }
          )
        }

        wsServer.broadcastGlobal(event, {
          ...data,
          senderId: payload.userId,
          senderRole: payload.role,
        })

        result = {
          broadcasted: true,
          event,
          recipientType: 'global'
        }
        break

      case 'notify_user':
        // Уведомление конкретному пользователю
        if (!targetUserId || !event) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Не указан ID пользователя или событие' },
            { status: 400 }
          )
        }

        wsServer.broadcastToUser(targetUserId, event, {
          ...data,
          senderId: payload.userId,
          senderRole: payload.role,
        })

        result = {
          notified: true,
          event,
          targetUserId,
          recipientType: 'user'
        }
        break

      case 'notify_role':
        // Уведомление пользователям с определенной ролью
        if (!targetRole || !event) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Не указана роль или событие' },
            { status: 400 }
          )
        }

        // Проверяем права для уведомления по ролям
        if (payload.role !== UserRole.ADMIN && 
            (targetRole === UserRole.ADMIN || payload.role !== UserRole.MANAGER)) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Недостаточно прав для уведомления данной роли' },
            { status: 403 }
          )
        }

        wsServer.broadcastToRole(targetRole, event, {
          ...data,
          senderId: payload.userId,
          senderRole: payload.role,
        })

        result = {
          notified: true,
          event,
          targetRole,
          recipientType: 'role'
        }
        break

      case 'notify_office':
        // Уведомление пользователям из офиса
        if (!targetOfficeId || !event) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Не указан ID офиса или событие' },
            { status: 400 }
          )
        }

        // Проверяем права для уведомления офиса
        if (payload.role === UserRole.CASHIER && 
            (!payload.officeIds || !payload.officeIds.includes(targetOfficeId))) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Нет доступа к данному офису' },
            { status: 403 }
          )
        }

        wsServer.broadcastToOffice(targetOfficeId, event, {
          ...data,
          senderId: payload.userId,
          senderRole: payload.role,
        })

        result = {
          notified: true,
          event,
          targetOfficeId,
          recipientType: 'office'
        }
        break

      case 'get_stats':
        // Получение статистики подключений
        result = NotificationService.getConnectionStats()
        break

      case 'test_connection':
        // Тестирование подключения
        if (message) {
          NotificationService.notifySystemMessage(
            message,
            severity || 'info',
            payload.role === UserRole.ADMIN ? undefined : payload.role
          )
        }

        result = {
          testCompleted: true,
          message: message || 'Тестовое сообщение',
          severity: severity || 'info',
          timestamp: new Date()
        }
        break

      default:
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Неподдерживаемая операция' },
          { status: 400 }
        )
    }

    console.log('WebSocket operation performed', {
      action,
      userId: payload.userId,
      userRole: payload.role,
      result,
      timestamp: new Date().toISOString()
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: result.broadcasted ? 'Сообщение отправлено всем пользователям' :
               result.notified ? 'Уведомление отправлено' :
               result.testCompleted ? 'Тест соединения выполнен' :
               'Операция выполнена'
    })

  } catch (error) {
    console.error('WebSocket operation error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
