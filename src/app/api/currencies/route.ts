import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { currencyCreateSchema, type ApiResponse, type CurrencyData } from '@/lib/types'
import { z } from 'zod'

// GET /api/currencies - Получить список валют
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const isActive = searchParams.get('isActive')

    const currencies = await prisma.currency.findMany({
      where: {
        ...(type && { type: type as any }),
        ...(isActive !== null && { isActive: isActive === 'true' })
      },
      orderBy: [
        { type: 'asc' },
        { code: 'asc' }
      ]
    })

    return NextResponse.json<ApiResponse<CurrencyData[]>>({
      success: true,
      data: currencies
    })

  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST /api/currencies - Создать новую валюту
export async function POST(request: NextRequest) {
  try {
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
    const validatedData = currencyCreateSchema.parse(body)

    // Проверяем уникальность кода валюты
    const existingCurrency = await prisma.currency.findUnique({
      where: { code: validatedData.code.toUpperCase() }
    })

    if (existingCurrency) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Валюта с таким кодом уже существует' 
      }, { status: 400 })
    }

    const currency = await prisma.currency.create({
      data: {
        ...validatedData,
        code: validatedData.code.toUpperCase()
      }
    })

    return NextResponse.json<ApiResponse<CurrencyData>>({
      success: true,
      data: currency,
      message: 'Валюта успешно создана'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.errors.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error creating currency:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
