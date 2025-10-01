import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { accountCreateSchema, type ApiResponse, type AccountData } from '@/lib/types'
import { z } from 'zod'
import { AccountType } from '@prisma/client'

// GET /api/accounts - Получить список счетов
export async function GET(request: NextRequest) {
  try {
    const { userRole, userOffices } = await AuthService.authenticateRequest(request)

    const { searchParams } = new URL(request.url)
    const officeId = searchParams.get('officeId')
    const currencyId = searchParams.get('currencyId')
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    // Ограничиваем доступ кассиров только к их офисам
    let officeFilter: { officeId?: { in: string[] } | string } = {}
    if (userRole === 'CASHIER' && userOffices) {
      officeFilter = { 
        officeId: { in: userOffices } 
      }
    }
    if (officeId) {
      if (userRole === 'CASHIER' && !userOffices?.includes(officeId)) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Access denied' 
        }, { status: 403 })
      }
      officeFilter = { officeId }
    }

    const accounts = await prisma.account.findMany({
      where: {
        ...officeFilter,
        ...(currencyId && { currencyId }),
        ...(type && { type: type as AccountType }),
        ...(isActive !== null && { isActive: isActive === 'true' })
      },
      include: {
        currency: true,
        office: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { office: { name: 'asc' } },
        { currency: { code: 'asc' } },
        { type: 'asc' }
      ]
    })

    return NextResponse.json<ApiResponse<AccountData[]>>({
      success: true,
      data: accounts
    })

  } catch (error) {
    console.error('Error fetching accounts:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST /api/accounts - Создать новый счет
export async function POST(request: NextRequest) {
  try {
    const { userRole, userOffices } = await AuthService.authenticateRequest(request)

    const body = await request.json()
    const validatedData = accountCreateSchema.parse(body)

    // Проверяем доступ к офису
    if (userRole === 'CASHIER' && 
        !userOffices?.includes(validatedData.officeId)) {
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

    // Проверяем уникальность счета (офис + валюта + тип)
    const existingAccount = await prisma.account.findUnique({
      where: {
        officeId_currencyId_type: {
          officeId: validatedData.officeId,
          currencyId: validatedData.currencyId,
          type: validatedData.type
        }
      }
    })

    if (existingAccount) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Счет для данной валюты и типа уже существует в этом офисе' 
      }, { status: 400 })
    }

    const account = await prisma.account.create({
      data: {
        ...validatedData,
        balance: validatedData.initialBalance
      },
      include: {
        currency: true,
        office: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    return NextResponse.json<ApiResponse<AccountData>>({
      success: true,
      data: account,
      message: 'Счет успешно создан'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.errors.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error creating account:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
