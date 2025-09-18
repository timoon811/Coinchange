import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { depositCreateSchema, type ApiResponse, type DepositData } from '@/lib/types'
import { z } from 'zod'

// GET /api/deposits - Получить список депозитов
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const officeId = searchParams.get('officeId')
    const currencyId = searchParams.get('currencyId')
    const clientId = searchParams.get('clientId')
    const isActive = searchParams.get('isActive')
    const expiringDays = searchParams.get('expiringDays')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Ограничиваем доступ кассиров только к их офисам
    let officeFilter: any = {}
    if (session.user.role === 'CASHIER' && session.user.officeIds) {
      officeFilter = { 
        officeId: { in: session.user.officeIds } 
      }
    }
    if (officeId) {
      if (session.user.role === 'CASHIER' && !session.user.officeIds?.includes(officeId)) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Access denied' 
        }, { status: 403 })
      }
      officeFilter = { officeId }
    }

    const where: any = {
      ...officeFilter,
      ...(type && { type: type as any }),
      ...(currencyId && { currencyId }),
      ...(clientId && { clientId }),
      ...(isActive !== null && { isActive: isActive === 'true' })
    }

    // Фильтр по истекающим депозитам
    if (expiringDays) {
      const daysAhead = parseInt(expiringDays)
      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + daysAhead)
      
      where.endDate = {
        lte: futureDate,
        gte: new Date()
      }
      where.isActive = true
    }

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        include: {
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          },
          office: {
            select: {
              id: true,
              name: true
            }
          },
          currency: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.deposit.count({ where })
    ])

    return NextResponse.json<ApiResponse<{ 
      deposits: DepositData[], 
      total: number, 
      page: number, 
      limit: number 
    }>>({
      success: true,
      data: {
        deposits,
        total,
        page,
        limit
      }
    })

  } catch (error) {
    console.error('Error fetching deposits:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST /api/deposits - Создать новый депозит
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = depositCreateSchema.parse(body)

    // Проверяем доступ к офису
    if (session.user.role === 'CASHIER' && 
        !session.user.officeIds?.includes(validatedData.officeId)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    // Проверяем существование офиса и валюты
    const [office, currency] = await Promise.all([
      prisma.office.findUnique({ where: { id: validatedData.officeId } }),
      prisma.currency.findUnique({ where: { id: validatedData.currencyId } })
    ])

    if (!office) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Офис не найден' 
      }, { status: 400 })
    }

    if (!currency) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Валюта не найдена' 
      }, { status: 400 })
    }

    // Проверяем клиента если указан
    if (validatedData.clientId) {
      const client = await prisma.client.findUnique({
        where: { id: validatedData.clientId }
      })
      if (!client) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Клиент не найден' 
        }, { status: 400 })
      }
    }

    // Рассчитываем дату окончания если указан срок
    let endDate: Date | undefined = undefined
    if (validatedData.term) {
      const startDate = validatedData.startDate ? 
        new Date(validatedData.startDate) : 
        new Date()
      endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + validatedData.term)
    } else if (validatedData.endDate) {
      endDate = new Date(validatedData.endDate)
    }

    const deposit = await prisma.deposit.create({
      data: {
        ...validatedData,
        startDate: validatedData.startDate ? 
          new Date(validatedData.startDate) : 
          new Date(),
        endDate
      },
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        },
        office: {
          select: {
            id: true,
            name: true
          }
        },
        currency: true
      }
    })

    return NextResponse.json<ApiResponse<DepositData>>({
      success: true,
      data: deposit,
      message: 'Депозит успешно создан'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.errors.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error creating deposit:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
