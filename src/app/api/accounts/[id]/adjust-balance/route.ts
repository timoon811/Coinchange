import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { type ApiResponse } from '@/lib/types'
import { UserRole, OperationType } from '@prisma/client'
import { z } from 'zod'

const adjustBalanceSchema = z.object({
  amount: z.number(),
  description: z.string().min(1, 'Описание обязательно')
})

// POST /api/accounts/[id]/adjust-balance - Корректировка баланса счета
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { userId, userRole, userOffices } = await AuthService.authenticateRequest(request)

    const body = await request.json()
    const validatedData = adjustBalanceSchema.parse(body)

    const existingAccount = await prisma.account.findUnique({
      where: { id },
      include: {
        currency: true,
        office: true
      }
    })

    if (!existingAccount) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Счет не найден' 
      }, { status: 404 })
    }

    // Проверяем доступ к офису
    if (userRole === UserRole.CASHIER && 
        !userOffices?.includes(existingAccount.officeId)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    const currentBalance = Number(existingAccount.balance)
    const newBalance = currentBalance + validatedData.amount

    // Проверяем лимиты
    if (existingAccount.minBalance !== null && newBalance < Number(existingAccount.minBalance)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Операция приведет к балансу ниже минимального' 
      }, { status: 400 })
    }

    if (existingAccount.maxBalance !== null && newBalance > Number(existingAccount.maxBalance)) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Операция приведет к балансу выше максимального' 
      }, { status: 400 })
    }

    // Выполняем операцию в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Обновляем баланс счета
      const updatedAccount = await tx.account.update({
        where: { id },
        data: { balance: newBalance },
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

      // Создаем запись операции
      await tx.operation.create({
        data: {
          fromAccountId: validatedData.amount < 0 ? id : null,
          toAccountId: validatedData.amount > 0 ? id : null,
          officeId: existingAccount.officeId,
          currencyId: existingAccount.currencyId,
          type: OperationType.ADJUSTMENT,
          amount: Math.abs(validatedData.amount),
          description: validatedData.description,
          performedBy: userId
        }
      })

      // Создаем запись аудита
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: 'BALANCE_ADJUSTMENT',
          entityType: 'Account',
          entityId: id,
          newValues: {
            accountName: existingAccount.name,
            amount: validatedData.amount,
            balanceBefore: currentBalance,
            balanceAfter: newBalance,
            description: validatedData.description
          }
        }
      })

      return updatedAccount
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: `Баланс успешно ${validatedData.amount > 0 ? 'увеличен' : 'уменьшен'} на ${Math.abs(validatedData.amount)} ${existingAccount.currency.code}`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        details: error.errors
      }, { status: 400 })
    }
    
    console.error('Error adjusting account balance:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
