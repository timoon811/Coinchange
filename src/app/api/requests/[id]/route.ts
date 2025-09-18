import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { EncryptionService } from '@/lib/encryption'
import { RequestStatus, UserRole } from '@prisma/client'
import type { AuthenticatedPayload } from '@/lib/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Аутентифицируем пользователя
    let payload: AuthenticatedPayload

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role
    const userOffices = payload.officeIds || []

    const requestId = id

    // Получаем заявку с полными данными
    const requestData = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        client: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
            phone: true,
            languageCode: true,
            tags: true,
            notes: true,
            totalRequests: true,
            totalVolume: true,
            isBlocked: true,
            createdAt: true,
          },
        },
        office: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            phone: true,
            activeCurrencies: true,
            activeNetworks: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        finance: true,
        requisites: true,
        attachments: true,
        comments: {
          include: {
            author: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
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

    // Проверяем права доступа
    if (userRole === UserRole.CASHIER && !userOffices.includes(requestData.officeId)) {
      return NextResponse.json(
        { error: 'Нет доступа к этой заявке' },
        { status: 403 }
      )
    }

    // Расшифровываем чувствительные данные
    let requisites = (requestData as any).requisites
    if (requisites) {
      requisites = {
        ...requisites,
        walletAddress: requisites.walletAddress
          ? EncryptionService.decrypt(requisites.walletAddress)
          : null,
        cardNumber: requisites.cardNumber
          ? EncryptionService.decrypt(requisites.cardNumber)
          : null,
      }
    }

    // Рассчитываем SLA статус
    const now = new Date()
    const isOverdue = requestData.slaDeadline &&
      requestData.slaDeadline < now &&
      requestData.status !== RequestStatus.COMPLETED

    const timeToSLA = requestData.slaDeadline
      ? Math.max(0, requestData.slaDeadline.getTime() - now.getTime())
      : null

    // Получаем историю статусов из аудита
    const statusHistory = await prisma.auditLog.findMany({
      where: {
        entityType: 'request',
        entityId: requestId,
        action: 'status_change',
      },
      select: {
        id: true,
        action: true,
        oldValues: true,
        newValues: true,
        createdAt: true,
        actor: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Добавляем подсчет комментариев и вложений
    const attachmentsCount = requestData.attachments ? requestData.attachments.length : 0
    const commentsCount = requestData.comments ? requestData.comments.length : 0

    return NextResponse.json({
      success: true,
      data: {
        ...requestData,
        requisites,
        isOverdue,
        timeToSLA,
        statusHistory,
        _count: {
          attachments: attachmentsCount,
          comments: commentsCount,
        },
      },
    })

  } catch (error) {
    console.error('Get request error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Аутентифицируем пользователя
    let payload: AuthenticatedPayload

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role
    const userOffices = payload.officeIds || []

    const requestId = id
    const updates = await request.json()

    // Получаем текущую заявку для проверки прав доступа
    const currentRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        officeId: true,
        status: true,
        assignedUserId: true,
      },
    })

    if (!currentRequest) {
      return NextResponse.json(
        { error: 'Заявка не найдена' },
        { status: 404 }
      )
    }

    // Проверяем права доступа
    if (userRole === UserRole.CASHIER && !userOffices.includes(currentRequest.officeId)) {
      return NextResponse.json(
        { error: 'Нет доступа к этой заявке' },
        { status: 403 }
      )
    }

    // Валидируем обновления
    const allowedFields = [
      'status',
      'assignedUserId',
      'officeId',
      'slaDeadline',
      'isOverdue',
    ]

    const filteredUpdates: any = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    // Если изменяется статус, добавляем временные метки
    if (filteredUpdates.status) {
      if (filteredUpdates.status === RequestStatus.ASSIGNED) {
        filteredUpdates.assignedAt = new Date()
      } else if (filteredUpdates.status === RequestStatus.COMPLETED) {
        filteredUpdates.completedAt = new Date()
      }
    }

    // Обновляем заявку
    const updatedRequest = await prisma.request.update({
      where: { id: requestId },
      data: filteredUpdates,
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        office: {
          select: {
            name: true,
          },
        },
        assignedUser: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    })

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        entityType: 'request',
        entityId: requestId,
        action: updates.status ? 'status_change' : 'update',
        oldValues: currentRequest,
        newValues: filteredUpdates,
      },
    })

    // Если статус изменился, создаем уведомления
    if (updates.status && updates.status !== currentRequest.status) {
      // Уведомление клиенту (через Telegram бот - в будущем)
      // Уведомление кассиру
      if (updatedRequest.assignedUserId) {
        await prisma.notification.create({
          data: {
            userId: updatedRequest.assignedUserId,
            type: 'STATUS_CHANGE',
            title: 'Статус заявки изменен',
            message: `Заявка ${updatedRequest.requestId} переведена в статус "${updates.status}"`,
            payload: {
              requestId: requestId,
              oldStatus: currentRequest.status,
              newStatus: updates.status,
            },
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedRequest,
      message: 'Заявка успешно обновлена',
    })

  } catch (error) {
    console.error('Update request error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT - полное обновление заявки
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Аутентификация
    const resolvedParams = await params
    const requestId = resolvedParams.id
    
    let payload: AuthenticatedPayload
    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const { userId, role } = payload

    if (!userId) {
      return NextResponse.json(
        { error: 'Токен недействителен' },
        { status: 401 }
      )
    }

    // Проверяем права доступа
    if (role !== UserRole.ADMIN) {
      return NextResponse.json(
        { error: 'Недостаточно прав для редактирования заявки' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { clientId, officeId, direction, finance, requisites } = body

    // Проверяем существование заявки
    const currentRequest = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        client: true,
        office: true,
        finance: true,
        requisites: true,
      },
    })

    if (!currentRequest) {
      return NextResponse.json(
        { error: 'Заявка не найдена' },
        { status: 404 }
      )
    }

    // Проверяем, можно ли редактировать заявку (только если статус позволяет)
    const editableStatuses = [RequestStatus.NEW, RequestStatus.ASSIGNED, RequestStatus.AWAITING_CLIENT]
    if (!editableStatuses.includes(currentRequest.status)) {
      return NextResponse.json(
        { error: 'Заявку нельзя редактировать в текущем статусе' },
        { status: 400 }
      )
    }

    // Обновляем заявку в транзакции
    const updatedRequest = await prisma.$transaction(async (tx) => {
      // Обновляем основную информацию заявки
      const request = await tx.request.update({
        where: { id: requestId },
        data: {
          clientId,
          officeId: officeId || null,
          direction,
          updatedAt: new Date(),
        },
        include: {
          client: {
            select: {
              id: true,
              telegramUserId: true,
              username: true,
              firstName: true,
              lastName: true,
              phone: true,
              tags: true,
              notes: true,
              _count: {
                select: {
                  requests: true,
                },
              },
            },
          },
          office: {
            select: {
              id: true,
              name: true,
              city: true,
              address: true,
              phone: true,
            },
          },
          assignedUser: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          finance: true,
          requisites: true,
        },
      })

      // Обновляем или создаем финансовые данные
      if (finance) {
        await tx.requestFinance.upsert({
          where: { requestId },
          update: {
            fromCurrency: finance.fromCurrency,
            toCurrency: finance.toCurrency,
            expectedAmountFrom: finance.expectedAmountFrom,
            expectedAmountTo: finance.expectedAmountTo || null,
            rateValue: finance.rateValue || null,
            commissionPercent: finance.commissionPercent || null,
          },
          create: {
            requestId,
            fromCurrency: finance.fromCurrency,
            toCurrency: finance.toCurrency,
            expectedAmountFrom: finance.expectedAmountFrom,
            expectedAmountTo: finance.expectedAmountTo || null,
            rateValue: finance.rateValue || null,
            commissionPercent: finance.commissionPercent || null,
          },
        })
      }

      // Обновляем или создаем реквизиты
      if (requisites) {
        await tx.requestRequisites.upsert({
          where: { requestId },
          update: {
            walletAddress: requisites.walletAddress || null,
            cardNumber: requisites.cardNumber || null,
            cardMasked: requisites.cardNumber 
              ? `**** **** **** ${requisites.cardNumber.slice(-4)}`
              : null,
            bankName: requisites.bankName || null,
          },
          create: {
            requestId,
            walletAddress: requisites.walletAddress || null,
            cardNumber: requisites.cardNumber || null,
            cardMasked: requisites.cardNumber 
              ? `**** **** **** ${requisites.cardNumber.slice(-4)}`
              : null,
            bankName: requisites.bankName || null,
          },
        })
      }

      return request
    })

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        entityType: 'request',
        entityId: requestId,
        action: 'full_update',
        oldValues: {
          clientId: currentRequest.clientId,
          officeId: currentRequest.officeId,
          direction: currentRequest.direction,
          finance: currentRequest.finance,
          requisites: currentRequest.requisites,
        },
        newValues: { clientId, officeId, direction, finance, requisites },
      },
    })

    // Перезагружаем заявку с обновленными данными
    const finalRequest = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        client: {
          select: {
            id: true,
            telegramUserId: true,
            username: true,
            firstName: true,
            lastName: true,
            phone: true,
            tags: true,
            notes: true,
            _count: {
              select: {
                requests: true,
              },
            },
          },
        },
        office: {
          select: {
            id: true,
            name: true,
            city: true,
            address: true,
            phone: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        finance: true,
        requisites: true,
        attachments: {
          select: {
            id: true,
            filename: true,
            originalName: true,
            fileUrl: true,
            fileSize: true,
            mimeType: true,
            type: true,
            uploadedBy: true,
            createdAt: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        statusHistory: {
          include: {
            actor: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        ...finalRequest,
        client: {
          ...finalRequest!.client,
          totalRequests: finalRequest!.client._count.requests,
          totalVolume: null, // TODO: вычислить общий объем
        },
        timeToSLA: finalRequest!.slaDeadline 
          ? Math.max(0, Math.floor((new Date(finalRequest!.slaDeadline).getTime() - Date.now()) / 1000))
          : null,
        isOverdue: finalRequest!.slaDeadline 
          ? new Date(finalRequest!.slaDeadline) < new Date()
          : false,
      },
    })

  } catch (error) {
    console.error('PUT request error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
