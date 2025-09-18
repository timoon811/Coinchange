import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { type ApiResponse, type AccountData } from '@/lib/types'
import { UserRole } from '@prisma/client'
import { z } from 'zod'

const accountUpdateSchema = z.object({
  name: z.string().min(1, 'Название счета обязательно').max(100).optional(),
  description: z.string().max(500).optional(),
  minBalance: z.number().min(0).optional(),
  maxBalance: z.number().min(0).optional(),
  isActive: z.boolean().optional(),
})

const balanceUpdateSchema = z.object({
  amount: z.number(),
  description: z.string().max(500).optional(),
})

// GET /api/accounts/[id] - Получить счет по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let payload: any
    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        currency: true,
        office: {
          select: {
            id: true,
            name: true,
            city: true
          }
        },
        _count: {
          select: {
            operations: true,
            deposits: true
          }
        }
      }
    })

    if (!account) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Счет не найден' 
      }, { status: 404 })
    }

    // Проверяем доступ к офису
    if (payload.role === UserRole.CASHIER && 
        !payload.officeIds?.includes(account.officeId)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    return NextResponse.json<ApiResponse<AccountData>>({
      success: true,
      data: account
    })

  } catch (error) {
    console.error('Error fetching account:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// PUT /api/accounts/[id] - Обновить счет
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let payload: any
    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = accountUpdateSchema.parse(body)

    const existingAccount = await prisma.account.findUnique({
      where: { id }
    })

    if (!existingAccount) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Счет не найден' 
      }, { status: 404 })
    }

    // Проверяем доступ к офису
    if (payload.role === UserRole.CASHIER && 
        !payload.officeIds?.includes(existingAccount.officeId)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: validatedData,
      include: {
        currency: true,
        office: {
          select: {
            id: true,
            name: true,
            city: true
          }
        }
      }
    })

    return NextResponse.json<ApiResponse<AccountData>>({
      success: true,
      data: updatedAccount,
      message: 'Счет успешно обновлен'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }
    
    console.error('Error updating account:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// DELETE /api/accounts/[id] - Удалить счет
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let payload: any
    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    const existingAccount = await prisma.account.findUnique({
      where: { id },
      include: {
        operations: true,
        deposits: true
      }
    })

    if (!existingAccount) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Счет не найден' 
      }, { status: 404 })
    }

    // Проверяем, используется ли счет
    if (existingAccount.operations.length > 0 || existingAccount.deposits.length > 0) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Нельзя удалить счет с операциями' 
      }, { status: 400 })
    }

    await prisma.account.delete({
      where: { id }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Счет успешно удален'
    })

  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST /api/accounts/[id]/balance - Обновить баланс счета
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    let payload: any
    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = balanceUpdateSchema.parse(body)

    const existingAccount = await prisma.account.findUnique({
      where: { id }
    })

    if (!existingAccount) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Счет не найден' 
      }, { status: 404 })
    }

    // Проверяем доступ к офису
    if (payload.role === UserRole.CASHIER && 
        !payload.officeIds?.includes(existingAccount.officeId)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    const newBalance = existingAccount.balance + validatedData.amount

    // Проверяем лимиты
    if (existingAccount.minBalance !== null && newBalance < existingAccount.minBalance) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Операция приведет к балансу ниже минимального' 
      }, { status: 400 })
    }

    if (existingAccount.maxBalance !== null && newBalance > existingAccount.maxBalance) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Операция приведет к балансу выше максимального' 
      }, { status: 400 })
    }

    const updatedAccount = await prisma.account.update({
      where: { id },
      data: {
        balance: newBalance,
        lastOperationAt: new Date()
      }
    })

    // Создаем запись об операции
    await prisma.operation.create({
      data: {
        accountId: id,
        amount: validatedData.amount,
        description: validatedData.description || 'Ручная корректировка баланса',
        type: validatedData.amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
        actorId: payload.userId
      }
    })

    return NextResponse.json<ApiResponse<AccountData>>({
      success: true,
      data: updatedAccount,
      message: 'Баланс успешно обновлен'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }
    
    console.error('Error updating balance:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}