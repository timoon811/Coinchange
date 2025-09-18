import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ClientFilters, ApiResponse } from '@/lib/types'
import { z } from 'zod'

// ClientFilters импортирован из @/lib/types

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

    // Парсим параметры запроса
    const filters: ClientFilters = {}

    const search = searchParams.get('search')
    if (search) {
      filters.search = search
    }

    const tags = searchParams.get('tags')
    if (tags) {
      filters.tags = tags.split(',')
    }

    const blocked = searchParams.get('blocked')
    if (blocked !== null) {
      filters.blocked = blocked === 'true'
    }

    const hasPhone = searchParams.get('hasPhone')
    if (hasPhone !== null) {
      filters.hasPhone = hasPhone === 'true'
    }

    const minRequests = searchParams.get('minRequests')
    if (minRequests) {
      filters.minRequests = parseInt(minRequests)
    }

    const maxRequests = searchParams.get('maxRequests')
    if (maxRequests) {
      filters.maxRequests = parseInt(maxRequests)
    }

    const minVolume = searchParams.get('minVolume')
    if (minVolume) {
      filters.minVolume = parseFloat(minVolume)
    }

    const maxVolume = searchParams.get('maxVolume')
    if (maxVolume) {
      filters.maxVolume = parseFloat(maxVolume)
    }

    const dateFrom = searchParams.get('dateFrom')
    if (dateFrom) {
      filters.dateFrom = new Date(dateFrom)
    }

    const dateTo = searchParams.get('dateTo')
    if (dateTo) {
      filters.dateTo = new Date(dateTo)
    }

    // Пагинация
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    // Сортировка
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'

    // Строим условия WHERE
    const where: Record<string, unknown> = {
      totalRequests: undefined as number | undefined,
      totalVolume: undefined as any,
      createdAt: undefined as Date | undefined,
    }

    // Поиск по тексту
    if (filters.search) {
      where.OR = [
        { username: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Фильтр по меткам
    if (filters.tags && filters.tags.length > 0) {
      where.tags = {
        hasSome: filters.tags,
      }
    }

    // Фильтр по блокировке
    if (filters.blocked !== undefined) {
      where.isBlocked = filters.blocked
    }

    // Фильтр по наличию телефона
    if (filters.hasPhone !== undefined) {
      where.phone = filters.hasPhone ? { not: null } : null
    }

    // Фильтр по количеству заявок
    if (filters.minRequests !== undefined || filters.maxRequests !== undefined) {
      where.totalRequests = {}
      if (filters.minRequests !== undefined) {
        where.totalRequests.gte = filters.minRequests
      }
      if (filters.maxRequests !== undefined) {
        where.totalRequests.lte = filters.maxRequests
      }
    }

    // Фильтр по объему
    if (filters.minVolume !== undefined || filters.maxVolume !== undefined) {
      where.totalVolume = {}
      if (filters.minVolume !== undefined) {
        where.totalVolume.gte = filters.minVolume
      }
      if (filters.maxVolume !== undefined) {
        where.totalVolume.lte = filters.maxVolume
      }
    }

    // Фильтр по датам
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo
      }
    }

    // Получаем общее количество
    const total = await prisma.client.count({ where })

    // Получаем клиентов с пагинацией
    const clients = await prisma.client.findMany({
      where,
      include: {
        _count: {
          select: {
            requests: true,
          },
        },
      },
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip: offset,
      take: limit,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: clients.map(client => ({
        id: client.id,
        telegramUserId: client.telegramUserId,
        username: client.username,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        tags: client.tags,
        notes: client.notes,
        totalRequests: client.totalRequests,
        totalVolume: client.totalVolume,
        isBlocked: client.isBlocked,
        createdAt: client.createdAt,
        updatedAt: client.updatedAt,
        requestsCount: client._count.requests,
      })),
      message: 'Clients retrieved successfully'
    })

  } catch (error) {
    console.error('Clients list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// Схема валидации для создания клиента
const createClientSchema = z.object({
  firstName: z.string().nullable().optional(),
  lastName: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  telegramUserId: z.string().min(1, 'Telegram ID обязателен'),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
  isBlocked: z.boolean().optional(),
})

// POST /api/clients - Создать нового клиента
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

    const userRole = payload.role

    // Только администраторы могут создавать клиентов
    if (userRole !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Недостаточно прав для создания клиентов' },
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

    const validationResult = createClientSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные клиента',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем уникальность Telegram ID
    const existingClient = await prisma.client.findUnique({
      where: { telegramUserId: data.telegramUserId },
    })

    if (existingClient) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Клиент с таким Telegram ID уже существует' },
        { status: 409 }
      )
    }

    // Создаем клиента
    const newClient = await prisma.client.create({
      data: {
        firstName: data.firstName || null,
        lastName: data.lastName || null,
        username: data.username || null,
        phone: data.phone || null,
        telegramUserId: data.telegramUserId,
        tags: data.tags || [],
        notes: data.notes || null,
        isBlocked: data.isBlocked || false,
        totalRequests: 0,
        totalVolume: 0,
      },
      include: {
        _count: {
          select: {
            requests: true,
          },
        },
      },
    })

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: payload.userId,
        entityType: 'client',
        entityId: newClient.id,
        action: 'create',
        newValues: {
          firstName: newClient.firstName,
          lastName: newClient.lastName,
          username: newClient.username,
          phone: newClient.phone,
          telegramUserId: newClient.telegramUserId,
          tags: newClient.tags,
          notes: newClient.notes,
          isBlocked: newClient.isBlocked,
        },
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        id: newClient.id,
        telegramUserId: newClient.telegramUserId,
        username: newClient.username,
        firstName: newClient.firstName,
        lastName: newClient.lastName,
        phone: newClient.phone,
        tags: newClient.tags,
        notes: newClient.notes,
        totalRequests: newClient.totalRequests,
        totalVolume: newClient.totalVolume,
        isBlocked: newClient.isBlocked,
        createdAt: newClient.createdAt,
        updatedAt: newClient.updatedAt,
        requestsCount: newClient._count.requests,
      },
      message: 'Клиент успешно создан'
    })

  } catch (error) {
    console.error('Create client error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
