import { NextRequest, NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notifications'
import { type ApiResponse } from '@/lib/types'

// POST /api/notifications/check - Запуск проверок уведомлений
export async function POST(request: NextRequest) {
  try {
    // Проверяем, что запрос идет от внутренней системы или cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const results = await NotificationService.runDailyChecks()

    return NextResponse.json<ApiResponse<typeof results>>({
      success: true,
      data: results,
      message: 'Проверки уведомлений выполнены'
    })

  } catch (error) {
    console.error('Error running notification checks:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// GET /api/notifications/check - Ручной запуск проверок (только для админов)
export async function GET(request: NextRequest) {
  try {
    // Аутентифицируем пользователя
    const { AuthService } = await import('@/lib/auth')
    let payload: any

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем что пользователь - администратор
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }
    
    const results = await NotificationService.runDailyChecks()

    return NextResponse.json<ApiResponse<typeof results>>({
      success: true,
      data: results,
      message: 'Проверки уведомлений выполнены вручную'
    })

  } catch (error) {
    console.error('Error running notification checks:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
