import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Аутентифицируем пользователя
    let payload: any

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role as UserRole
    const userOffices = payload.officeIds || []

    const requestId = id
    const { text, isInternal = false } = await request.json()

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Текст комментария обязателен' },
        { status: 400 }
      )
    }

    // Проверяем существование заявки и права доступа
    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        officeId: true,
        clientId: true,
      },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Заявка не найдена' },
        { status: 404 }
      )
    }

    // Проверяем права доступа
    if (userRole === UserRole.CASHIER && !userOffices.includes(existingRequest.officeId)) {
      return NextResponse.json(
        { error: 'Нет доступа к этой заявке' },
        { status: 403 }
      )
    }

    // Создаем комментарий
    const comment = await prisma.comment.create({
      data: {
        requestId: requestId,
        authorId: userId,
        text: text.trim(),
        isInternal: isInternal && userRole === UserRole.ADMIN, // Только админ может создавать внутренние комментарии
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
    })

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        entityType: 'comment',
        entityId: comment.id,
        action: 'create',
        newValues: {
          text: comment.text,
          isInternal: comment.isInternal,
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: comment,
      message: 'Комментарий добавлен',
    })

  } catch (error) {
    console.error('Add comment error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Аутентифицируем пользователя
    let payload: any

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const userId = payload.userId
    const userRole = payload.role as UserRole
    const userOffices = payload.officeIds || []

    const requestId = id

    // Проверяем существование заявки и права доступа
    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        officeId: true,
        clientId: true,
      },
    })

    if (!existingRequest) {
      return NextResponse.json(
        { error: 'Заявка не найдена' },
        { status: 404 }
      )
    }

    // Проверяем права доступа
    if (userRole === UserRole.CASHIER && !userOffices.includes(existingRequest.officeId)) {
      return NextResponse.json(
        { error: 'Нет доступа к этой заявке' },
        { status: 403 }
      )
    }

    // Получаем комментарии
    const comments = await prisma.comment.findMany({
      where: {
        requestId: requestId,
        // Кассиры видят только публичные комментарии, админы видят все
        isInternal: userRole === UserRole.CASHIER ? false : undefined,
      },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return NextResponse.json({
      success: true,
      data: comments,
    })

  } catch (error) {
    console.error('Get comments error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
