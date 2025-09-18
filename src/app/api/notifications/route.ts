import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    // Аутентифицируем пользователя
    let payload: any

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role as UserRole

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const showRead = searchParams.get('showRead') === 'true'
    const offset = (page - 1) * limit

    // Получаем уведомления пользователя
    const where: any = {
      userId,
    }

    if (!showRead) {
      where.isRead = false
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    })

    const total = await prisma.notification.count({ where })

    // Получаем количество непрочитанных уведомлений
    const unreadCount = await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    })

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      unreadCount,
    })

  } catch (error) {
    console.error('Notifications error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Аутентифицируем пользователя
    let payload: any

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role as UserRole

    const { action, notificationIds } = await request.json()

    if (!action) {
      return NextResponse.json(
        { error: 'Необходимо указать action' },
        { status: 400 }
      )
    }

    if (action === 'mark_read') {
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return NextResponse.json(
          { error: 'Необходимо указать notificationIds' },
          { status: 400 }
        )
      }

      // Отмечаем уведомления как прочитанные
      await prisma.notification.updateMany({
        where: {
          id: {
            in: notificationIds,
          },
          userId, // Только свои уведомления
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Уведомления отмечены как прочитанные',
      })

    } else if (action === 'mark_all_read') {
      // Отмечаем все уведомления как прочитанные
      await prisma.notification.updateMany({
        where: {
          userId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Все уведомления отмечены как прочитанные',
      })

    } else if (action === 'delete') {
      if (!notificationIds || !Array.isArray(notificationIds)) {
        return NextResponse.json(
          { error: 'Необходимо указать notificationIds' },
          { status: 400 }
        )
      }

      // Удаляем уведомления
      await prisma.notification.deleteMany({
        where: {
          id: {
            in: notificationIds,
          },
          userId, // Только свои уведомления
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Уведомления удалены',
      })
    }

    return NextResponse.json(
      { error: 'Неизвестное действие' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Notifications action error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
