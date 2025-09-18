import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { RequestStatus, OperationDirection, UserRole, NetworkType } from '@prisma/client'
import type { AuthenticatedPayload, RequestFilters, ApiResponse } from '@/lib/types'
import { requestFiltersSchema } from '@/lib/types'
import { validatePaginationFromUrl, calculateOffset, createPaginationMeta, createPaginatedResponse, normalizeBoolean, normalizeArray } from '@/lib/pagination'
import { z } from 'zod'

// RequestFilters импортирован из @/lib/types

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

    const userId = payload.userId
    const userRole = payload.role
    const userOffices = payload.officeIds

    const { searchParams } = new URL(request.url)

    // Валидируем пагинацию с улучшенной обработкой
    const pagination = validatePaginationFromUrl(request)
    const offset = calculateOffset(pagination.page, pagination.limit)

    // Парсим параметры фильтрации
    const filters = {
      status: normalizeArray(searchParams.get('status'))?.map(s => s as RequestStatus).filter(s => Object.values(RequestStatus).includes(s)) || [],
      direction: normalizeArray(searchParams.get('direction'))?.map(d => d as OperationDirection).filter(d => Object.values(OperationDirection).includes(d)) || [],
      officeId: normalizeArray(searchParams.get('officeId')) || [],
      assignedUserId: normalizeArray(searchParams.get('assignedUserId')) || [],
      clientId: normalizeArray(searchParams.get('clientId')) || [],
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      search: searchParams.get('search'),
      currency: normalizeArray(searchParams.get('currency')) || [],
      network: normalizeArray(searchParams.get('network')) || [],
    }

    // Сортировка с валидацией
    const allowedSortFields = ['createdAt', 'updatedAt', 'requestId', 'status', 'direction']
    const sortBy = allowedSortFields.includes(pagination.sortBy || '') ? pagination.sortBy! : 'createdAt'
    const sortOrder = pagination.sortOrder

    // Применяем RBAC фильтры
    let officeFilter = {}
    if (userRole === UserRole.CASHIER) {
      // Кассир видит только заявки своих офисов
      officeFilter = {
        officeId: {
          in: userOffices,
        },
      }
    } else if (filters.officeId && filters.officeId.length > 0) {
      // Админ может фильтровать по офисам
      officeFilter = {
        officeId: {
          in: filters.officeId,
        },
      }
    }

    // Строим условия WHERE
    const where: Record<string, unknown> = {
      ...officeFilter,
    }

    // Фильтр по статусам
    if (filters.status && filters.status.length > 0) {
      where.status = {
        in: filters.status,
      }
    }

    // Фильтр по направлениям
    if (filters.direction && filters.direction.length > 0) {
      where.direction = {
        in: filters.direction,
      }
    }

    // Фильтр по кассирам
    if (filters.assignedUserId && filters.assignedUserId.length > 0) {
      where.assignedUserId = {
        in: filters.assignedUserId,
      }
    }

    // Фильтр по клиентам
    if (filters.clientId && filters.clientId.length > 0) {
      where.clientId = {
        in: filters.clientId,
      }
    }

    // Фильтр по датам
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom)
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo)
      }
    }

    // Поиск по тексту
    if (filters.search) {
      where.OR = [
        { requestId: { contains: filters.search, mode: 'insensitive' } },
        {
          client: {
            OR: [
              { username: { contains: filters.search, mode: 'insensitive' } },
              { firstName: { contains: filters.search, mode: 'insensitive' } },
              { lastName: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
        {
          finance: {
            OR: [
              { fromCurrency: { contains: filters.search, mode: 'insensitive' } },
              { toCurrency: { contains: filters.search, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    // Фильтр по валютам
    if (filters.currency && filters.currency.length > 0) {
      where.finance = {
        ...(where.finance as any || {}),
        OR: [
          ...((where.finance as any)?.OR || []),
          { fromCurrency: { in: filters.currency } },
          { toCurrency: { in: filters.currency } },
        ],
      }
    }

    // Фильтр по сетям
    if (filters.network && filters.network.length > 0) {
      where.finance = {
        ...(where.finance as any || {}),
        fromNetwork: {
          in: filters.network,
        },
      }
    }

    // Получаем общее количество
    const total = await prisma.request.count({ where })

    // Получаем заявки с пагинацией
    const requests = await prisma.request.findMany({
      where,
      include: {
        client: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            phone: true,
            tags: true,
          },
        },
        office: {
          select: {
            id: true,
            name: true,
            city: true,
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
        finance: {
          select: {
            fromCurrency: true,
            fromNetwork: true,
            toCurrency: true,
            expectedAmountFrom: true,
            expectedAmountTo: true,
            rateValue: true,
            commissionPercent: true,
          },
        },
        _count: {
          select: {
            attachments: true,
            comments: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: offset,
      take: pagination.limit,
    })

    // Рассчитываем SLA статус
    const now = new Date()
    const requestsWithSLA = requests.map(request => ({
      ...request,
      isOverdue: request.slaDeadline && request.slaDeadline < now && request.status !== RequestStatus.COMPLETED,
      timeToSLA: request.slaDeadline ? Math.max(0, request.slaDeadline.getTime() - now.getTime()) : null,
    }))

    // Создаем метаданные пагинации
    const paginationMeta = createPaginationMeta(pagination.page, pagination.limit, total)

    return NextResponse.json(createPaginatedResponse(
      requestsWithSLA,
      paginationMeta,
      'Заявки успешно получены'
    ))

  } catch (error) {
    console.error('Requests list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// Схема валидации для создания заявки
const createRequestSchema = z.object({
  clientId: z.string().min(1, 'ID клиента обязателен'),
  direction: z.nativeEnum(OperationDirection),
  officeId: z.string().optional(),
  
  // Финансовая информация
  finance: z.object({
    fromCurrency: z.string().min(1, 'Валюта отправления обязательна'),
    fromNetwork: z.nativeEnum(NetworkType).optional(),
    toCurrency: z.string().min(1, 'Валюта получения обязательна'),
    expectedAmountFrom: z.number().positive('Сумма должна быть положительной'),
    expectedAmountTo: z.number().positive().optional(),
    rateValue: z.number().positive().optional(),
    commissionPercent: z.number().min(0).max(100).optional(),
  }),
  
  // Реквизиты
  requisites: z.object({
    walletAddress: z.string().optional(),
    cardNumber: z.string().optional(),
    cardMasked: z.string().optional(),
    bankName: z.string().optional(),
    extraData: z.any().optional(),
  }).optional(),
  
  // Дополнительные поля
  comment: z.string().optional(),
  slaDeadline: z.string().datetime().optional(),
})

// POST /api/requests - Создать новую заявку
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

    const userId = payload.userId
    const userRole = payload.role

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

    const validationResult = createRequestSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные заявки',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем существование клиента
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
    })

    if (!client) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Клиент не найден' },
        { status: 404 }
      )
    }

    // Проверяем офис если указан
    if (data.officeId) {
      const office = await prisma.office.findUnique({
        where: { id: data.officeId },
      })

      if (!office) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Офис не найден' },
          { status: 404 }
        )
      }

      // Проверяем доступ кассира к офису
      if (userRole === UserRole.CASHIER && !payload.officeIds?.includes(data.officeId)) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Нет доступа к данному офису' },
          { status: 403 }
        )
      }
    }

    // Генерируем уникальный ID заявки
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    // Создаем заявку в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем заявку
      const newRequest = await tx.request.create({
        data: {
          requestId,
          clientId: data.clientId,
          officeId: data.officeId,
          assignedUserId: userRole === UserRole.CASHIER ? userId : undefined,
          direction: data.direction,
          status: RequestStatus.NEW,
          source: 'manual',
          slaDeadline: data.slaDeadline ? new Date(data.slaDeadline) : undefined,
        },
        include: {
          client: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          office: {
            select: {
              id: true,
              name: true,
              city: true,
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
        },
      })

      // Создаем финансовую информацию
      const finance = await tx.requestFinance.create({
        data: {
          requestId: newRequest.id,
          fromCurrency: data.finance.fromCurrency,
          fromNetwork: data.finance.fromNetwork,
          toCurrency: data.finance.toCurrency,
          expectedAmountFrom: data.finance.expectedAmountFrom,
          expectedAmountTo: data.finance.expectedAmountTo,
          rateValue: data.finance.rateValue,
          commissionPercent: data.finance.commissionPercent,
        },
      })

      // Создаем реквизиты если указаны
      if (data.requisites) {
        await tx.requisites.create({
          data: {
            requestId: newRequest.id,
            walletAddress: data.requisites.walletAddress,
            cardNumber: data.requisites.cardNumber,
            cardMasked: data.requisites.cardMasked,
            bankName: data.requisites.bankName,
            extraData: data.requisites.extraData as any,
          },
        })
      }

      // Создаем комментарий если указан
      if (data.comment) {
        await tx.comment.create({
          data: {
            requestId: newRequest.id,
            authorId: userId,
            text: data.comment,
            isInternal: false,
          },
        })
      }

      // Обновляем статистику клиента
      await tx.client.update({
        where: { id: data.clientId },
        data: {
          totalRequests: { increment: 1 },
          lastContactDate: new Date(),
        },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: userId,
          entityType: 'request',
          entityId: newRequest.id,
          action: 'create',
          newValues: {
            requestId: newRequest.requestId,
            direction: data.direction,
            finance: data.finance,
          } as any,
        },
      })

      return {
        ...newRequest,
        finance,
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Заявка успешно создана',
    })

  } catch (error) {
    console.error('Create request error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
