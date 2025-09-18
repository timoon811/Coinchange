import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { userUpdateSchema } from '@/lib/types'

// GET /api/admin/users/[id] - Получить информацию о пользователе
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

    // Проверяем права (админ или сам пользователь)
    if (payload.role !== UserRole.ADMIN && payload.userId !== id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        officeIds: true,
        isActive: true,
        notificationPrefs: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            assignedRequests: true,
            createdComments: true,
            auditLogs: true,
            exchangeRates: true,
            operations: true,
            notifications: true,
          },
        },
        assignedRequests: {
          select: {
            id: true,
            requestId: true,
            status: true,
            direction: true,
            createdAt: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Получаем информацию об офисах
    const offices = await prisma.office.findMany({
      where: { id: { in: user.officeIds } },
      select: { id: true, name: true, city: true, isActive: true },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        ...user,
        offices,
      },
    })

  } catch (error) {
    console.error('Get user error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/users/[id] - Обновить пользователя
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

    // Проверяем права (админ или сам пользователь для ограниченных полей)
    const isSelfUpdate = payload.userId === id
    if (payload.role !== UserRole.ADMIN && !isSelfUpdate) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен' },
        { status: 403 }
      )
    }

    // Проверяем существование пользователя
    const existingUser = await prisma.user.findUnique({
      where: { id },
    })

    if (!existingUser) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Пользователь не найден' },
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

    // Ограничиваем поля для самообновления
    if (isSelfUpdate && payload.role !== UserRole.ADMIN) {
      const allowedFields = ['firstName', 'lastName', 'email', 'password']
      const filteredBody: any = {}
      
      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          filteredBody[field] = body[field]
        }
      }
      
      body = filteredBody
    }

    // Валидируем данные
    const validationResult = userUpdateSchema.safeParse(body)
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

    // Проверяем уникальность username и email
    if (updateData.username || updateData.email) {
      const conflictUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                ...(updateData.username ? [{ username: updateData.username }] : []),
                ...(updateData.email ? [{ email: updateData.email }] : []),
              ],
            },
          ],
        },
      })

      if (conflictUser) {
        const field = conflictUser.username === updateData.username ? 'username' : 'email'
        return NextResponse.json<ApiResponse>(
          { success: false, error: `Пользователь с таким ${field} уже существует` },
          { status: 409 }
        )
      }
    }

    // Проверяем существование офисов
    if (updateData.officeIds && updateData.officeIds.length > 0) {
      const offices = await prisma.office.findMany({
        where: { id: { in: updateData.officeIds } },
      })

      if (offices.length !== updateData.officeIds.length) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Один или несколько офисов не найдены' },
          { status: 400 }
        )
      }
    }

    // Хешируем пароль если он обновляется
    if (updateData.password) {
      updateData.password = await AuthService.hashPassword(updateData.password)
    }

    // Обновляем пользователя в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id },
        data: updateData,
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
          entityId: id,
          action: 'update',
          oldValues: {
            username: existingUser.username,
            role: existingUser.role,
            isActive: existingUser.isActive,
          } as any,
          newValues: updateData as any,
        },
      })

      return updatedUser
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Пользователь успешно обновлен',
    })

  } catch (error) {
    console.error('Update user error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/users/[id] - Удалить пользователя (деактивировать)
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

    // Проверяем что пользователь не удаляет сам себя
    if (payload.userId === id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Нельзя удалить самого себя' },
        { status: 400 }
      )
    }

    // Проверяем существование пользователя
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            assignedRequests: {
              where: {
                status: {
                  notIn: ['COMPLETED', 'CANCELED', 'REJECTED'],
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Пользователь не найден' },
        { status: 404 }
      )
    }

    // Проверяем можно ли деактивировать пользователя
    if (user._count.assignedRequests > 0) {
      return NextResponse.json<ApiResponse>(
        { 
          success: false, 
          error: 'Нельзя деактивировать пользователя с активными назначенными заявками' 
        },
        { status: 400 }
      )
    }

    // Деактивируем пользователя
    const result = await prisma.$transaction(async (tx) => {
      const deactivatedUser = await tx.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          isActive: true,
        },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'user',
          entityId: id,
          action: 'deactivate',
          oldValues: { isActive: true } as any,
          newValues: { isActive: false } as any,
        },
      })

      return deactivatedUser
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Пользователь деактивирован',
    })

  } catch (error) {
    console.error('Delete user error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}