import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'

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

    const clientId = id

    // Получаем детальную информацию о клиенте
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        _count: {
          select: {
            requests: true,
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json(
        { error: 'Клиент не найден' },
        { status: 404 }
      )
    }

    // Получаем статистику клиента
    const clientStats = await prisma.request.groupBy({
      by: ['status'],
      where: { clientId },
      _count: {
        id: true,
      },
    })

    const totalVolume = await prisma.requestFinance.aggregate({
      where: {
        request: { clientId },
      },
      _sum: {
        expectedAmountFrom: true,
      },
    })

    const avgVolume = await prisma.requestFinance.aggregate({
      where: {
        request: { clientId },
      },
      _avg: {
        expectedAmountFrom: true,
      },
    })

    // Получаем историю заявок клиента
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const requests = await prisma.request.findMany({
      where: { clientId },
      include: {
        office: {
          select: {
            name: true,
            city: true,
          },
        },
        assignedUser: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        finance: {
          select: {
            fromCurrency: true,
            toCurrency: true,
            expectedAmountFrom: true,
            expectedAmountTo: true,
            commissionPercent: true,
          },
        },
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    })

    const totalRequests = await prisma.request.count({
      where: { clientId },
    })

    // Получаем последние комментарии к заявкам клиента
    const recentComments = await prisma.comment.findMany({
      where: {
        request: {
          clientId,
        },
      },
      include: {
        request: {
          select: {
            requestId: true,
          },
        },
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
      take: 5,
    })

    // Рассчитываем метрики клиента
    const completedRequests = clientStats.find(s => s.status === 'COMPLETED')?._count.id || 0
    const totalRequestsCount = clientStats.reduce((sum, s) => sum + s._count.id, 0)
    const conversionRate = totalRequestsCount > 0 ? (completedRequests / totalRequestsCount) * 100 : 0

    const lastRequest = requests.length > 0 ? requests[0].createdAt : null
    const daysSinceLastRequest = lastRequest
      ? Math.floor((Date.now() - lastRequest.getTime()) / (1000 * 60 * 60 * 24))
      : null

    return NextResponse.json({
      success: true,
      data: {
        ...client,
        requestsCount: client._count.requests,
        stats: {
          totalVolume: totalVolume._sum.expectedAmountFrom || 0,
          avgVolume: avgVolume._avg.expectedAmountFrom || 0,
          conversionRate: Math.round(conversionRate * 100) / 100,
          daysSinceLastRequest,
          statusBreakdown: clientStats.map(stat => ({
            status: stat.status,
            count: stat._count.id,
          })),
        },
        requests: {
          data: requests.map(req => ({
            id: req.id,
            requestId: req.requestId,
            status: req.status,
            direction: req.direction,
            createdAt: req.createdAt,
            completedAt: req.completedAt,
            office: req.office,
            assignedUser: req.assignedUser,
            finance: req.finance,
            commentsCount: req._count.comments,
            attachmentsCount: req._count.attachments,
          })),
          pagination: {
            page,
            limit,
            total: totalRequests,
            pages: Math.ceil(totalRequests / limit),
          },
        },
        recentComments: recentComments.map(comment => ({
          id: comment.id,
          text: comment.text,
          isInternal: comment.isInternal,
          createdAt: comment.createdAt,
          requestId: comment.request.requestId,
          author: comment.author,
        })),
      },
    })

  } catch (error) {
    console.error('Get client error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const clientId = params.id
    const updates = await request.json()

    // Проверяем существование клиента
    const existingClient = await prisma.client.findUnique({
      where: { id: clientId },
    })

    if (!existingClient) {
      return NextResponse.json(
        { error: 'Клиент не найден' },
        { status: 404 }
      )
    }

    // Валидируем обновления
    const allowedFields = [
      'firstName',
      'lastName',
      'phone',
      'tags',
      'notes',
      'isBlocked',
    ]

    const filteredUpdates: any = {}
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field]
      }
    }

    // Обновляем клиента
    const updatedClient = await prisma.client.update({
      where: { id: clientId },
      data: filteredUpdates,
    })

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        entityType: 'client',
        entityId: clientId,
        action: 'update',
        oldValues: existingClient,
        newValues: filteredUpdates,
      },
    })

    return NextResponse.json({
      success: true,
      data: updatedClient,
      message: 'Информация о клиенте обновлена',
    })

  } catch (error) {
    console.error('Update client error:', error)
    return NextResponse.json(
      { error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}
