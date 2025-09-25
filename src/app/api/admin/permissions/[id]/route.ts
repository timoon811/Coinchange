import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { permissionUpdateSchema } from '@/lib/types'

// GET /api/admin/permissions/[id] - Получить право по ID
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

    // Проверяем права администратора
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    // Получаем право
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: true
      }
    })

    if (!permission) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Право не найдено' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: permission,
    })

  } catch (error) {
    console.error('Get permission error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/permissions/[id] - Обновить право
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

    // Проверяем существование права
    const existingPermission = await prisma.permission.findUnique({
      where: { id }
    })

    if (!existingPermission) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Право не найдено' },
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
    const validationResult = permissionUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные права',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем уникальность имени (если оно изменяется)
    if (data.name && data.name !== existingPermission.name) {
      const duplicatePermission = await prisma.permission.findUnique({
        where: { name: data.name }
      })

      if (duplicatePermission) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Право с таким названием уже существует' },
          { status: 400 }
        )
      }
    }

    // Обновляем право
    const permission = await prisma.permission.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.resource !== undefined && { resource: data.resource }),
        ...(data.conditions !== undefined && { conditions: data.conditions }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: {
        rolePermissions: true
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: permission,
    })

  } catch (error) {
    console.error('Update permission error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/permissions/[id] - Удалить право
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

    // Проверяем существование права
    const existingPermission = await prisma.permission.findUnique({
      where: { id },
      include: {
        rolePermissions: true
      }
    })

    if (!existingPermission) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Право не найдено' },
        { status: 404 }
      )
    }

    // Удаляем право (связанные rolePermissions удалятся автоматически через CASCADE)
    await prisma.permission.delete({
      where: { id }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'Право успешно удалено' },
    })

  } catch (error) {
    console.error('Delete permission error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

