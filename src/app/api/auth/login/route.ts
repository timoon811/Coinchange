import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { loginSchema } from '@/lib/types'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  let body
  try {
    body = await request.json()
  } catch (error) {
    return NextResponse.json(
      { error: 'Неверный формат JSON' },
      { status: 400 }
    )
  }

  try {
    // Валидация входных данных
    const validationResult = loginSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Неверные данные для входа',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const { username, password } = validationResult.data

    // Находим пользователя
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        officeIds: true,
        isActive: true,
        password: true, // Добавим пароль в select для проверки
      },
    })

    if (!user || !user.isActive) {
      logger.security('FAILED_LOGIN_ATTEMPT', {
        username,
        reason: !user ? 'user_not_found' : 'user_inactive',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
      })

      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      )
    }

    // Проверяем пароль
    const isValidPassword = await AuthService.verifyPassword(password, user.password)
    if (!isValidPassword) {
      logger.security('FAILED_LOGIN_ATTEMPT', {
        username,
        userId: user.id,
        reason: 'invalid_password',
        ip: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent'),
      })

      return NextResponse.json(
        { error: 'Неверные учетные данные' },
        { status: 401 }
      )
    }

    // Создаем токен
    const token = AuthService.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role,
      officeIds: user.officeIds,
    })

    // Логируем успешный вход
    logger.audit(user.id, 'LOGIN_SUCCESS', 'user', user.id, {
      username: user.username,
      role: user.role,
      ip: request.headers.get('x-forwarded-for') || request.ip,
      userAgent: request.headers.get('user-agent'),
    })

    // Создаем ответ с токеном в cookie
    const response = NextResponse.json({
      success: true,
      token: token, // Добавляем токен для API
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        officeIds: user.officeIds,
      },
    })

    // Устанавливаем HTTP-only cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 7 дней
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
