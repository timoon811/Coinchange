import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { officeCreateSchema } from '@/lib/types'

// GET /api/admin/offices - Получить список офисов
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
    const city = searchParams.get('city')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Строим условия WHERE
    const where: any = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (city) {
      where.city = { contains: city, mode: 'insensitive' }
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    // Получаем общее количество
    const total = await prisma.office.count({ where })

    // Получаем офисы с пагинацией
    const offices = await prisma.office.findMany({
      where,
      include: {
        _count: {
          select: {
            requests: true,
            accounts: true,
            operations: true,
          },
        },
      },
      orderBy: [
        { isActive: 'desc' },
        { name: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        offices,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })

  } catch (error) {
    console.error('Admin offices list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/offices - Создать новый офис
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
    const validationResult = officeCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные офиса',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Создаем офис в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем офис
      const office = await tx.office.create({
        data: {
          name: data.name,
          city: data.city,
          address: data.address,
          phone: data.phone,
          email: data.email,
          activeCurrencies: data.activeCurrencies,
          activeNetworks: data.activeNetworks,
          isActive: data.isActive,
        },
        include: {
          _count: {
            select: {
              requests: true,
              accounts: true,
              operations: true,
            },
          },
        },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'office',
          entityId: office.id,
          action: 'create',
          newValues: {
            name: office.name,
            city: office.city,
            address: office.address,
          } as any,
        },
      })

      return office
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Офис успешно создан',
    })

  } catch (error) {
    console.error('Create office error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}