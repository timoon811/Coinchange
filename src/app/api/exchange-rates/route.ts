import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { CacheService, ExchangeRateCache } from '@/lib/cache'
import { exchangeRateCreateSchema, type ApiResponse, type ExchangeRateData } from '@/lib/types'
import { z } from 'zod'

// GET /api/exchange-rates - Получить курсы валют
export async function GET(request: NextRequest) {
  try {
    const { userId, userRole, userOffices } = await AuthService.authenticateRequest(request)

    const { searchParams } = new URL(request.url)
    const currencyId = searchParams.get('currencyId')
    const rateDate = searchParams.get('rateDate')
    const isActive = searchParams.get('isActive')
    const latest = searchParams.get('latest') === 'true'

    let whereClause: any = {}
    
    if (currencyId) {
      whereClause.currencyId = currencyId
    }
    
    if (rateDate) {
      whereClause.rateDate = new Date(rateDate)
    }
    
    if (isActive !== null) {
      whereClause.isActive = isActive === 'true'
    }

    // Если нужны только последние курсы
    if (latest) {
      const cacheKey = CacheService.keys.exchangeRatesStats()
      
      const latestRates = await CacheService.getOrSet(
        cacheKey,
        async () => {
          return await prisma.exchangeRate.findMany({
            where: whereClause,
            include: {
              currency: true,
              setter: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true
                }
              }
            },
            orderBy: {
              rateDate: 'desc'
            },
            distinct: ['currencyId']
          })
        },
        60 * 1000 // Кешируем на 1 минуту
      )

      return NextResponse.json<ApiResponse<ExchangeRateData[]>>({
        success: true,
        data: latestRates
      })
    }

    const exchangeRates = await prisma.exchangeRate.findMany({
      where: whereClause,
      include: {
        currency: true,
        setter: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [
        { rateDate: 'desc' },
        { currency: { code: 'asc' } }
      ]
    })

    return NextResponse.json<ApiResponse<ExchangeRateData[]>>({
      success: true,
      data: exchangeRates
    })

  } catch (error) {
    console.error('Error fetching exchange rates:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// POST /api/exchange-rates - Создать/обновить курс валюты
export async function POST(request: NextRequest) {
  try {
    const { userId, userRole, userOffices } = await AuthService.authenticateRequest(request)

    const body = await request.json()
    const validatedData = exchangeRateCreateSchema.parse(body)

    // Проверяем существование валюты
    const currency = await prisma.currency.findUnique({
      where: { id: validatedData.currencyId, isActive: true }
    })

    if (!currency) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Валюта не найдена или неактивна' 
      }, { status: 400 })
    }

    // Проверяем базовую валюту, если указана
    if (validatedData.baseCurrencyId) {
      const baseCurrency = await prisma.currency.findUnique({
        where: { id: validatedData.baseCurrencyId, isActive: true }
      })

      if (!baseCurrency) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Базовая валюта не найдена или неактивна' 
        }, { status: 400 })
      }
    }

    // Дополнительная валидация курса и маржи
    if (validatedData.purchaseRate <= 0) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Курс закупки должен быть положительным числом' 
      }, { status: 400 })
    }

    if (validatedData.defaultMargin < 0 || validatedData.defaultMargin > 100) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Маржа должна быть от 0 до 100%' 
      }, { status: 400 })
    }

    const rateDate = validatedData.rateDate ? 
      new Date(validatedData.rateDate) : 
      new Date()

    // Устанавливаем время в начало дня для корректного сравнения
    rateDate.setHours(0, 0, 0, 0)

    // Рассчитываем курс продажи
    const sellRate = validatedData.purchaseRate * (1 + validatedData.defaultMargin / 100)

    // Проверяем, есть ли уже курс на эту дату
    const existingRate = await prisma.exchangeRate.findUnique({
      where: {
        currencyId_rateDate: {
          currencyId: validatedData.currencyId,
          rateDate
        }
      }
    })

    let exchangeRate: any

    if (existingRate) {
      // Обновляем существующий курс
      exchangeRate = await prisma.exchangeRate.update({
        where: {
          currencyId_rateDate: {
            currencyId: validatedData.currencyId,
            rateDate
          }
        },
        data: {
          purchaseRate: validatedData.purchaseRate,
          sellRate,
          defaultMargin: validatedData.defaultMargin,
          setBy: userId,
          isActive: true
        },
        include: {
          currency: true,
          setter: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })
    } else {
      // Создаем новый курс
      exchangeRate = await prisma.exchangeRate.create({
        data: {
          currencyId: validatedData.currencyId,
          baseCurrencyId: validatedData.baseCurrencyId,
          purchaseRate: validatedData.purchaseRate,
          sellRate,
          defaultMargin: validatedData.defaultMargin,
          rateDate,
          setBy: userId
        },
        include: {
          currency: true,
          setter: {
            select: {
              id: true,
              firstName: true,
              lastName: true
            }
          }
        }
      })
    }

    // Инвалидируем кеш курсов валют для данной валюты и связанных курсов
    ExchangeRateCache.invalidateRates([exchangeRate.currency.code])
    CacheService.delete(CacheService.keys.exchangeRatesStats())
    
    // Также инвалидируем общий кеш курсов
    ExchangeRateCache.invalidateRates()

    return NextResponse.json<ApiResponse<ExchangeRateData>>({
      success: true,
      data: exchangeRate,
      message: existingRate ? 'Курс валюты успешно обновлен' : 'Курс валюты успешно установлен'
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.issues.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error creating/updating exchange rate:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

// PUT /api/exchange-rates/bulk - Массовое обновление курсов
export async function PUT(request: NextRequest) {
  try {
    const { userId, userRole, userOffices } = await AuthService.authenticateRequest(request)

    const body = await request.json()
    const { rates, rateDate: rateDateStr } = body

    if (!Array.isArray(rates) || rates.length === 0) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Список курсов не может быть пустым' 
      }, { status: 400 })
    }

    const rateDate = rateDateStr ? new Date(rateDateStr) : new Date()
    rateDate.setHours(0, 0, 0, 0)

    // Валидируем каждый курс
    const validatedRates = rates.map((rate: any) => 
      exchangeRateCreateSchema.parse(rate)
    )

    // Проверяем существование всех валют
    const currencyIds = validatedRates.map(r => r.currencyId)
    const currencies = await prisma.currency.findMany({
      where: { 
        id: { in: currencyIds },
        isActive: true
      }
    })

    if (currencies.length !== currencyIds.length) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Одна или несколько валют не найдены' 
      }, { status: 400 })
    }

    // Выполняем массовое обновление в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const updatedRates = []
      const updatedCurrencies = new Set<string>()

      for (const rateData of validatedRates) {
        // Валидируем данные курса
        if (rateData.purchaseRate <= 0) {
          throw new Error(`Курс закупки должен быть положительным для валюты ${rateData.currencyId}`)
        }

        if (rateData.defaultMargin < 0 || rateData.defaultMargin > 100) {
          throw new Error(`Маржа должна быть от 0 до 100% для валюты ${rateData.currencyId}`)
        }

        const sellRate = rateData.purchaseRate * (1 + rateData.defaultMargin / 100)

        // Получаем информацию о валюте для логирования
        const currencyInfo = await tx.currency.findUnique({
          where: { id: rateData.currencyId },
          select: { code: true, name: true }
        })

        if (!currencyInfo) {
          throw new Error(`Валюта с ID ${rateData.currencyId} не найдена`)
        }

        const exchangeRate = await tx.exchangeRate.upsert({
          where: {
            currencyId_rateDate: {
              currencyId: rateData.currencyId,
              rateDate
            }
          },
          update: {
            purchaseRate: rateData.purchaseRate,
            sellRate,
            defaultMargin: rateData.defaultMargin,
            setBy: userId,
            isActive: true,
            updatedAt: new Date()
          },
          create: {
            currencyId: rateData.currencyId,
            baseCurrencyId: rateData.baseCurrencyId || null,
            purchaseRate: rateData.purchaseRate,
            sellRate,
            defaultMargin: rateData.defaultMargin,
            rateDate,
            setBy: userId,
            isActive: true
          },
          include: {
            currency: true,
            setter: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        })

        updatedRates.push(exchangeRate)
        updatedCurrencies.add(currencyInfo.code)
      }

      // Инвалидируем кеш для всех обновленных валют
      ExchangeRateCache.invalidateRates(Array.from(updatedCurrencies))
      CacheService.delete(CacheService.keys.exchangeRatesStats())

      return updatedRates
    }, {
      maxWait: 30000, // 30 секунд максимальное ожидание
      timeout: 60000, // 60 секунд таймаут
    })

    return NextResponse.json<ApiResponse<ExchangeRateData[]>>({
      success: true,
      data: result,
      message: `Успешно обновлено курсов: ${result.length}`
    })

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Validation error',
        message: error.issues.map(e => e.message).join(', ')
      }, { status: 400 })
    }

    console.error('Error bulk updating exchange rates:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
