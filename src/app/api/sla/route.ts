import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole, RequestStatus, NotificationType } from '@prisma/client'
import { addMinutes, isAfter } from 'date-fns'

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
const userOffices = payload.officeIds || []

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'overdue' // overdue, upcoming, all

    const where: any = {}

    if (userRole === UserRole.CASHIER) {
      // Кассир видит только свои офисы
      where.officeId = {
        in: userOffices,
      }
    }

    // Фильтр по типу SLA
    const now = new Date()
    if (type === 'overdue') {
      where.slaDeadline = {
        lt: now,
      }
      where.status = {
        notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED, RequestStatus.REJECTED],
      }
    } else if (type === 'upcoming') {
      where.slaDeadline = {
        gt: now,
        lt: addMinutes(now, 60), // Следующие 60 минут
      }
      where.status = {
        notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED, RequestStatus.REJECTED],
      }
    }

    // Получаем заявки с SLA
    const requests = await prisma.request.findMany({
      where,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        office: {
          select: {
            name: true,
            city: true,
          },
        },
        assignedUser: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        finance: {
          select: {
            fromCurrency: true,
            expectedAmountFrom: true,
          },
        },
      },
      orderBy: {
        slaDeadline: 'asc',
      },
    })

    return NextResponse.json({
      success: true,
      data: requests.map(request => ({
        id: request.id,
        requestId: request.requestId,
        client: request.client,
        office: request.office,
        assignedUser: request.assignedUser,
        status: request.status,
        direction: request.direction,
        finance: request.finance,
        slaDeadline: request.slaDeadline,
        isOverdue: request.slaDeadline && isAfter(now, request.slaDeadline),
        timeToSLA: request.slaDeadline
          ? Math.max(0, Math.floor((request.slaDeadline.getTime() - now.getTime()) / (1000 * 60)))
          : null,
        createdAt: request.createdAt,
      })),
    })

  } catch (error) {
    console.error('SLA requests error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    if (userRole !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Недостаточно прав доступа' },
        { status: 403 }
      )
    }

    const { action, requestId } = await request.json()

    if (!action || !requestId) {
      return NextResponse.json(
        { error: 'Необходимо указать action и requestId' },
        { status: 400 }
      )
    }

    // Получаем заявку
    const requestData = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignedUser: true,
        office: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!requestData) {
      return NextResponse.json(
        { error: 'Заявка не найдена' },
        { status: 404 }
      )
    }

    if (action === 'extend_sla') {
      // Продлеваем SLA на 30 минут
      const newDeadline = addMinutes(new Date(), 30)

      await prisma.request.update({
        where: { id: requestId },
        data: {
          slaDeadline: newDeadline,
          isOverdue: false,
        },
      })

      // Создаем уведомление для кассира
      if (requestData.assignedUser) {
        await prisma.notification.create({
          data: {
            userId: requestData.assignedUser.id,
            type: NotificationType.SYSTEM,
            title: 'SLA продлено',
            message: `SLA для заявки ${requestData.requestId} продлено на 30 минут`,
            payload: {
              requestId: requestId,
              action: 'sla_extended',
            },
          },
        })
      }

      // Логируем действие
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          entityType: 'request',
          entityId: requestId,
          action: 'sla_extended',
          newValues: {
            slaDeadline: newDeadline,
          },
        },
      })

      return NextResponse.json({
        success: true,
        message: 'SLA успешно продлено',
      })

    } else if (action === 'send_reminder') {
      // Отправляем напоминание клиенту (через Telegram бот)
      // В будущем здесь будет интеграция с Telegram API

      // Создаем уведомление для кассира
      if (requestData.assignedUser) {
        await prisma.notification.create({
          data: {
            userId: requestData.assignedUser.id,
            type: NotificationType.SYSTEM,
            title: 'Напоминание отправлено',
            message: `Клиенту ${requestData.client.firstName} отправлено напоминание по заявке ${requestData.requestId}`,
            payload: {
              requestId: requestId,
              action: 'reminder_sent',
            },
          },
        })
      }

      // Логируем действие
      await prisma.auditLog.create({
        data: {
          actorId: userId,
          entityType: 'request',
          entityId: requestId,
          action: 'reminder_sent',
        },
      })

      return NextResponse.json({
        success: true,
        message: 'Напоминание отправлено',
      })
    }

    return NextResponse.json(
      { error: 'Неизвестное действие' },
      { status: 400 }
    )

  } catch (error) {
    console.error('SLA action error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
