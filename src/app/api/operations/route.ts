import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { operationCreateSchema, type ApiResponse, type OperationData } from '@/lib/types'
import { z } from 'zod'

// GET /api/operations - Получить список операций
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
    const officeId = searchParams.get('officeId')
    const type = searchParams.get('type')
    const currencyId = searchParams.get('currencyId')
    const categoryId = searchParams.get('categoryId')
    const clientId = searchParams.get('clientId')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const search = searchParams.get('search')
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
      ...(categoryId && { categoryId }),
      ...(clientId && { clientId }),
      ...(dateFrom && dateTo && { 
        createdAt: { 
          gte: new Date(dateFrom), 
          lte: new Date(dateTo) 
        } 
      }),
      ...(search && {
        OR: [
          { description: { contains: search, mode: 'insensitive' } },
          { notes: { contains: search, mode: 'insensitive' } }
        ]
      })
    }

    const [operations, total] = await Promise.all([
      prisma.operation.findMany({
        where,
        include: {
          fromAccount: {
            include: {
              currency: true
            }
          },
          toAccount: {
            include: {
              currency: true
            }
          },
          currency: true,
          request: {
            select: {
              id: true,
              requestId: true
            }
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          },
          category: true,
          performer: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.operation.count({ where })
    ])

    return NextResponse.json<ApiResponse<{ 
      operations: OperationData[], 
      total: number, 
      page: number, 
      limit: number 
    }>>({
      success: true,
      data: {
        operations,
        total,
        page,
        limit
      }
    })

  } catch (error) {
    console.error('Error fetching operations:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST /api/operations - Создать новую операцию
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
    const validatedData = operationCreateSchema.parse(body)

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

    // Проверяем счета если указаны
    if (validatedData.fromAccountId) {
      const fromAccount = await prisma.account.findUnique({
        where: { id: validatedData.fromAccountId }
      })
      if (!fromAccount) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Счет списания не найден' 
        }, { status: 400 })
      }
      if (fromAccount.officeId !== validatedData.officeId) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Счет списания не принадлежит указанному офису' 
        }, { status: 400 })
      }
    }

    if (validatedData.toAccountId) {
      const toAccount = await prisma.account.findUnique({
        where: { id: validatedData.toAccountId }
      })
      if (!toAccount) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Счет зачисления не найден' 
        }, { status: 400 })
      }
      if (toAccount.officeId !== validatedData.officeId) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Счет зачисления не принадлежит указанному офису' 
        }, { status: 400 })
      }
    }

    // Выполняем операцию в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем операцию
      const operation = await tx.operation.create({
        data: {
          ...validatedData,
          performedBy: session.user.id
        },
        include: {
          fromAccount: {
            include: {
              currency: true
            }
          },
          toAccount: {
            include: {
              currency: true
            }
          },
          currency: true,
          request: {
            select: {
              id: true,
              requestId: true
            }
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          },
          category: true,
          performer: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })

      // Обновляем балансы счетов
      if (validatedData.fromAccountId) {
        await tx.account.update({
          where: { id: validatedData.fromAccountId },
          data: {
            balance: {
              decrement: validatedData.amount
            }
          }
        })
      }

      if (validatedData.toAccountId) {
        await tx.account.update({
          where: { id: validatedData.toAccountId },
          data: {
            balance: {
              increment: validatedData.amount
            }
          }
        })
      }

      // Обновляем дату последнего обращения клиента
      if (validatedData.clientId) {
        await tx.client.update({
          where: { id: validatedData.clientId },
          data: {
            lastContactDate: new Date()
          }
        })
      }

      return operation
    })

    return NextResponse.json<ApiResponse<OperationData>>({
      success: true,
      data: result,
      message: 'Операция успешно выполнена'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.errors.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error creating operation:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
