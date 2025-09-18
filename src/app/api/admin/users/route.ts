import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { userCreateSchema } from '@/lib/types'

// GET /api/admin/users - Получить список пользователей
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

    const { searchParams } = new URL(request.url)
    
    // Параметры фильтрации
    const search = searchParams.get('search')
    const role = searchParams.get('role') as UserRole | null
    const isActive = searchParams.get('isActive')
    const officeId = searchParams.get('officeId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Строим условия WHERE
    const where: any = {}

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (role) {
      where.role = role
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    if (officeId) {
      where.officeIds = {
        has: officeId,
      }
    }

    // Получаем общее количество
    const total = await prisma.user.count({ where })

    // Получаем пользователей с пагинацией
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        officeIds: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedRequests: true,
            createdComments: true,
            auditLogs: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { role: 'asc' },
        { firstName: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    })

    // Получаем информацию об офисах для пользователей
    const officeIds = [...new Set(users.flatMap(user => user.officeIds))]
    const offices = await prisma.office.findMany({
      where: { id: { in: officeIds } },
      select: { id: true, name: true, city: true },
    })

    const officesMap = new Map(offices.map(office => [office.id, office]))

    // Обогащаем данные пользователей информацией об офисах
    const enrichedUsers = users.map(user => ({
      ...user,
      offices: user.officeIds.map(id => officesMap.get(id)).filter(Boolean),
    }))

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        users: enrichedUsers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })

  } catch (error) {
    console.error('Admin users list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/users - Создать нового пользователя
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

    // Парсим данные
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Неверный формат JSON' },
        { status: 400 }
      )
    }

    // Валидируем данные
    const validationResult = userCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные пользователя',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем уникальность username
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          ...(data.email ? [{ email: data.email }] : []),
        ],
      },
    })

    if (existingUser) {
      const field = existingUser.username === data.username ? 'username' : 'email'
      return NextResponse.json<ApiResponse>(
        { success: false, error: `Пользователь с таким ${field} уже существует` },
        { status: 409 }
      )
    }

    // Проверяем существование офисов
    if (data.officeIds.length > 0) {
      const offices = await prisma.office.findMany({
        where: { id: { in: data.officeIds } },
      })

      if (offices.length !== data.officeIds.length) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Один или несколько офисов не найдены' },
          { status: 400 }
        )
      }
    }

    // Хешируем пароль
    const hashedPassword = await AuthService.hashPassword(data.password)

    // Создаем пользователя в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: data.username,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          password: hashedPassword,
          role: data.role,
          officeIds: data.officeIds,
          isActive: true,
        },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          officeIds: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'user',
          entityId: user.id,
          action: 'create',
          newValues: {
            username: user.username,
            role: user.role,
            officeIds: user.officeIds,
          } as any,
        },
      })

      return user
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Пользователь успешно создан',
    })

  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}