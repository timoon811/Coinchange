import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { z } from 'zod'

// Схема валидации для создания правила комиссии
const commissionRuleCreateSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  description: z.string().max(500).optional(),
  scope: z.enum(['global', 'office', 'client', 'direction', 'amount_range']),
  conditions: z.record(z.unknown()).optional(), // JSON объект с условиями
  percent: z.number().min(0).max(100).optional(),
  fixed: z.number().min(0).optional(),
  priority: z.number().int().default(0),
  isActive: z.boolean().default(true),
})

// Схема валидации для обновления правила комиссии
// const commissionRuleUpdateSchema = commissionRuleCreateSchema.partial()

// GET /api/admin/commission-rules - Получить список правил комиссий
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
    const scope = searchParams.get('scope')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Строим условия WHERE
    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (scope) {
      where.scope = scope
    }

    if (isActive !== null && isActive !== undefined) {
      where.isActive = isActive === 'true'
    }

    // Получаем общее количество
    const total = await prisma.commissionRule.count({ where })

    // Получаем правила с пагинацией
    const rules = await prisma.commissionRule.findMany({
      where,
      orderBy: [
        { isActive: 'desc' },
        { priority: 'desc' },
        { name: 'asc' },
      ],
      skip: (page - 1) * limit,
      take: limit,
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        rules,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    })

  } catch (error) {
    console.error('Commission rules list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/commission-rules - Создать новое правило комиссии
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
    const validationResult = commissionRuleCreateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные правила комиссии',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем что указан хотя бы один тип комиссии
    if (!data.percent && !data.fixed) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Необходимо указать процентную или фиксированную комиссию' },
        { status: 400 }
      )
    }

    // Создаем правило в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const rule = await tx.commissionRule.create({
        data: {
          name: data.name,
          description: data.description,
          scope: data.scope,
          conditions: data.conditions as any,
          percent: data.percent,
          fixed: data.fixed,
          priority: data.priority,
          isActive: data.isActive,
        },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'commission_rule',
          entityId: rule.id,
          action: 'create',
          newValues: {
            name: rule.name,
            scope: rule.scope,
            percent: rule.percent,
            fixed: rule.fixed,
          } as any,
        },
      })

      return rule
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Правило комиссии успешно создано',
    })

  } catch (error) {
    console.error('Create commission rule error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}