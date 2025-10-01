import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { type ApiResponse, type CurrencyData } from '@/lib/types'
import { z } from 'zod'

const currencyUpdateSchema = z.object({
  name: z.string().min(1, 'Название валюты обязательно').max(100).optional(),
  symbol: z.string().max(10).optional(),
  decimals: z.number().int().min(0).max(18).optional(),
  isActive: z.boolean().optional(),
})

// GET /api/currencies/[id] - Получить валюту по ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const currency = await prisma.currency.findUnique({
      where: { id: id }
    })

    if (!currency) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Валюта не найдена' 
      }, { status: 404 })
    }

    const response = NextResponse.json<ApiResponse<CurrencyData>>({
      success: true,
      data: currency
    })
    
    // Добавляем CORS заголовки
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    
    return response

  } catch (error) {
    console.error('Error fetching currency:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// PUT /api/currencies/[id] - Обновить валюту
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
    
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = currencyUpdateSchema.parse(body)

    const existingCurrency = await prisma.currency.findUnique({
      where: { id: id }
    })

    if (!existingCurrency) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Валюта не найдена' 
      }, { status: 404 })
    }

    const currency = await prisma.currency.update({
      where: { id: id },
      data: validatedData
    })

    const response = NextResponse.json<ApiResponse<CurrencyData>>({
      success: true,
      data: currency,
      message: 'Валюта успешно обновлена'
    })
    
    // Добавляем CORS заголовки
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    
    return response

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.errors.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error updating currency:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// DELETE /api/currencies/[id] - Удалить валюту
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
    
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Access denied' 
      }, { status: 403 })
    }

    const existingCurrency = await prisma.currency.findUnique({
      where: { id: id },
      include: {
        accounts: true,
        operations: true,
        deposits: true,
        exchangeRates: true
      }
    })

    if (!existingCurrency) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Валюта не найдена' 
      }, { status: 404 })
    }

    // Проверяем, используется ли валюта в критичных местах
    if (existingCurrency.accounts.length > 0 || 
        existingCurrency.operations.length > 0 || 
        existingCurrency.deposits.length > 0) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Нельзя удалить валюту, которая используется в счетах, операциях или депозитах' 
      }, { status: 400 })
    }

    // Удаляем валюту вместе с курсами валют в транзакции
    await prisma.$transaction(async (tx) => {
      // Сначала удаляем все курсы валют для этой валюты
      if (existingCurrency.exchangeRates.length > 0) {
        await tx.exchangeRate.deleteMany({
          where: { currencyId: id }
        })
      }
      
      // Затем удаляем саму валюту
      await tx.currency.delete({
        where: { id: id }
      })
    })

    const response = NextResponse.json<ApiResponse>({
      success: true,
      message: existingCurrency.exchangeRates.length > 0 
        ? `Валюта и ${existingCurrency.exchangeRates.length} курсов валют успешно удалены`
        : 'Валюта успешно удалена'
    })
    
    // Добавляем CORS заголовки
    response.headers.set('Access-Control-Allow-Origin', 'http://localhost:3001')
    response.headers.set('Access-Control-Allow-Credentials', 'true')
    
    return response

  } catch (error) {
    console.error('Error deleting currency:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
