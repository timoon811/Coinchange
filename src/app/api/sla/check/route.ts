import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')
    const userRole = request.headers.get('x-user-role') as UserRole

    if (!userId || userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Недостаточно прав доступа' },
        { status: 403 }
      )
    }

    // Импортируем SLA монитор для запуска проверки
    const { SLAMonitor } = await import('@/lib/cron')

    // Запускаем проверку SLA
    await SLAMonitor.checkSLA()
    await SLAMonitor.checkOverdueRequests()

    return NextResponse.json({
      success: true,
      message: 'SLA проверка выполнена успешно',
    })

  } catch (error) {
    console.error('Manual SLA check error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
