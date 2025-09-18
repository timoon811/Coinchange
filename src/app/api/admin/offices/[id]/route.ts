import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse, OfficeUpdateData } from '@/lib/types'
import { z } from 'zod'

// Схема валидации для обновления офиса
const officeUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  address: z.string().min(1).max(200).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  schedule: z.any().optional(),
  activeCurrencies: z.array(z.string()).optional(),
  activeNetworks: z.array(z.string()).optional(),
  dailyLimits: z.any().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/admin/offices/[id] - Получить информацию об офисе
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
      return NextResponse.json<ApiResponse>(
        { success: false, error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    // Проверяем права (админ или кассир с доступом к офису)
    if (payload.role !== UserRole.ADMIN && !payload.officeIds?.includes(id)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Получаем офис
    const office = await prisma.office.findUnique({
      where: { id },
      include: {
        requests: {
          select: {
            id: true,
            requestId: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        accounts: {
          include: {
            currency: {
              select: {
                code: true,
                name: true,
                type: true,
              },
            },
          },
        },
        operations: {
          select: {
            id: true,
            type: true,
            amount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        _count: {
          select: {
            requests: true,
            accounts: true,
            operations: true,
            deposits: true,
          },
        },
      },
    })

    if (!office) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Офис не найден' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: office,
    })

  } catch (error) {
    console.error('Get office error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/offices/[id] - Обновить офис
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

    // Проверяем существование офиса
    const existingOffice = await prisma.office.findUnique({
      where: { id },
    })

    if (!existingOffice) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Офис не найден' },
        { status: 404 }
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
    const validationResult = officeUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные для обновления',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Обновляем офис в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const updatedOffice = await tx.office.update({
        where: { id },
        data: updateData,
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
          entityId: id,
          action: 'update',
          oldValues: {
            name: existingOffice.name,
            city: existingOffice.city,
            isActive: existingOffice.isActive,
          } as any,
          newValues: updateData as any,
        },
      })

      return updatedOffice
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Офис успешно обновлен',
    })

  } catch (error) {
    console.error('Update office error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/offices/[id] - Удалить офис (деактивировать)
export async function DELETE(
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

    // Проверяем существование офиса
    const office = await prisma.office.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            requests: {
              where: {
                status: {
                  notIn: ['COMPLETED', 'CANCELED', 'REJECTED'],
                },
              },
            },
            accounts: true,
          },
        },
      },
    })

    if (!office) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Офис не найден' },
        { status: 404 }
      )
    }

    // Проверяем можно ли удалить офис
    if (office._count.requests > 0) {
      return NextResponse.json<ApiResponse>(
        { 
          success: false, 
          error: 'Нельзя удалить офис с активными заявками. Сначала завершите все заявки.' 
        },
        { status: 400 }
      )
    }

    // Деактивируем офис вместо удаления
    const result = await prisma.$transaction(async (tx) => {
      const deactivatedOffice = await tx.office.update({
        where: { id },
        data: { isActive: false },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'office',
          entityId: id,
          action: 'deactivate',
          oldValues: { isActive: true } as any,
          newValues: { isActive: false } as any,
        },
      })

      return deactivatedOffice
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Офис деактивирован',
    })

  } catch (error) {
    console.error('Delete office error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}