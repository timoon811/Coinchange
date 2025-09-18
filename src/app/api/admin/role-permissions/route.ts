import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { rolePermissionSchema } from '@/lib/types'

// GET /api/admin/role-permissions - Получить права ролей
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
    const role = searchParams.get('role') as UserRole | null

    // Строим условия WHERE
    const where: any = {}
    if (role) {
      where.role = role
    }

    // Получаем права ролей
    const rolePermissions = await prisma.rolePermission.findMany({
      where,
      include: {
        permission: true
      },
      orderBy: [
        { role: 'asc' },
        { permission: { type: 'asc' } },
        { permission: { resource: 'asc' } },
      ]
    })

    // Группируем по ролям для удобства
    const groupedByRole = rolePermissions.reduce((acc, rp) => {
      if (!acc[rp.role]) {
        acc[rp.role] = []
      }
      acc[rp.role].push(rp)
      return acc
    }, {} as Record<UserRole, typeof rolePermissions>)

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        rolePermissions,
        groupedByRole,
      },
    })

  } catch (error) {
    console.error('Role permissions list error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/admin/role-permissions - Назначить право роли
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
    const validationResult = rolePermissionSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные права роли',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем существование права
    const permission = await prisma.permission.findUnique({
      where: { id: data.permissionId }
    })

    if (!permission) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Право не найдено' },
        { status: 404 }
      )
    }

    // Проверяем, не назначено ли уже это право роли
    const existingRolePermission = await prisma.rolePermission.findUnique({
      where: {
        role_permissionId: {
          role: data.role,
          permissionId: data.permissionId
        }
      }
    })

    if (existingRolePermission) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Это право уже назначено данной роли' },
        { status: 400 }
      )
    }

    // Создаем связь роль-право
    const rolePermission = await prisma.rolePermission.create({
      data: {
        role: data.role,
        permissionId: data.permissionId,
        restrictions: data.restrictions,
        isActive: data.isActive,
      },
      include: {
        permission: true
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: rolePermission,
    })

  } catch (error) {
    console.error('Create role permission error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/role-permissions - Массовое обновление прав роли
export async function PUT(request: NextRequest) {
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

    const { role, permissionIds } = body

    if (!role || !Array.isArray(permissionIds)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Некорректные данные. Ожидается role и массив permissionIds' },
        { status: 400 }
      )
    }

    // Проверяем роль
    if (!Object.values(UserRole).includes(role)) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Некорректная роль' },
        { status: 400 }
      )
    }

    // Проверяем существование всех прав
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
        isActive: true
      }
    })

    if (permissions.length !== permissionIds.length) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Некоторые права не найдены или неактивны' },
        { status: 400 }
      )
    }

    // Выполняем транзакцию для обновления прав роли
    const result = await prisma.$transaction(async (tx) => {
      // Удаляем все текущие права роли
      await tx.rolePermission.deleteMany({
        where: { role }
      })

      // Добавляем новые права
      const newRolePermissions = await Promise.all(
        permissionIds.map((permissionId: string) =>
          tx.rolePermission.create({
            data: {
              role,
              permissionId,
              isActive: true,
            },
            include: {
              permission: true
            }
          })
        )
      )

      return newRolePermissions
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        role,
        permissions: result,
        message: `Права роли ${role} успешно обновлены`
      },
    })

  } catch (error) {
    console.error('Bulk update role permissions error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
