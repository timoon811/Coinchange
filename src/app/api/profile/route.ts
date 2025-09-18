import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import type { ApiResponse } from '@/lib/types'

// Схема валидации для обновления профиля
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'Имя обязательно').max(50),
  lastName: z.string().max(50).optional(),
  email: z.string().email('Некорректный email').optional(),
  notificationPrefs: z.any().optional(),
})

// Схема валидации для смены пароля
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Текущий пароль обязателен'),
  newPassword: z.string().min(8, 'Новый пароль должен содержать минимум 8 символов'),
  confirmPassword: z.string().min(1, 'Подтверждение пароля обязательно'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
})

// GET /api/profile - Получить профиль текущего пользователя
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const payload = AuthService.verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Недействительный токен' },
        { status: 401 }
      )
    }

    // Получаем данные пользователя
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
      },
    })

    if (!user || !user.isActive) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Пользователь не найден или заблокирован' },
        { status: 401 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user,
    })
  } catch (error) {
    console.error('Get profile error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PUT /api/profile - Обновить профиль
export async function PUT(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const payload = AuthService.verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Недействительный токен' },
        { status: 401 }
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
    const validationResult = updateProfileSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные профиля',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Проверяем уникальность email (если изменяется)
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          id: { not: payload.userId }
        }
      })

      if (existingUser) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Пользователь с таким email уже существует' },
          { status: 400 }
        )
      }
    }

    // Обновляем профиль
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        notificationPrefs: data.notificationPrefs,
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
        notificationPrefs: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedUser,
    })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// POST /api/profile - Смена пароля
export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Не авторизован' },
        { status: 401 }
      )
    }

    const payload = AuthService.verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Недействительный токен' },
        { status: 401 }
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
    const validationResult = changePasswordSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные для смены пароля',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validationResult.data

    // Получаем текущий пароль пользователя
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, password: true, isActive: true }
    })

    if (!user || !user.isActive) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Пользователь не найден или заблокирован' },
        { status: 401 }
      )
    }

    // Проверяем текущий пароль
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password)
    if (!isCurrentPasswordValid) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Неверный текущий пароль' },
        { status: 400 }
      )
    }

    // Хэшируем новый пароль
    const saltRounds = 12
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds)

    // Обновляем пароль
    await prisma.user.update({
      where: { id: payload.userId },
      data: { password: hashedNewPassword }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { message: 'Пароль успешно изменен' },
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
