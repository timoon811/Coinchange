import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import { type ApiResponse, type TurnoverReportData, type AuthenticatedPayload } from '@/lib/types'

// GET /api/reports/turnover - Отчет по обороту
export async function GET(request: NextRequest) {
  try {
    // Аутентифицируем пользователя
    let payload: AuthenticatedPayload

    try {
      payload = await AuthService.authenticateRequest(request)
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: error instanceof Error ? error.message : 'Не авторизован' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const officeId = searchParams.get('officeId')

    if (!dateFrom || !dateTo) {
      return NextResponse.json<ApiResponse>({ 
        success: false, 
        error: 'Необходимо указать период (dateFrom и dateTo)' 
      }, { status: 400 })
    }

    const startDate = new Date(dateFrom)
    const endDate = new Date(dateTo)
    endDate.setHours(23, 59, 59, 999)

    const period = `${startDate.toLocaleDateString('ru-RU')} - ${endDate.toLocaleDateString('ru-RU')}`

    // Ограничиваем доступ кассиров только к их офисам
    let officeFilter: any = {}
    if (payload.userRole === UserRole.CASHIER && payload.userOffices && payload.userOffices.length > 0) {
      officeFilter = { 
        officeId: { in: payload.userOffices } 
      }
    }
    if (officeId) {
      if (payload.userRole === UserRole.CASHIER && !payload.userOffices?.includes(officeId)) {
        return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: 'Доступ запрещен' 
        }, { status: 403 })
      }
      officeFilter = { officeId }
    }

    // Получаем все операции за период
    const operations = await prisma.operation.findMany({
      where: {
        ...officeFilter,
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        currency: true,
        office: {
          select: {
            id: true,
            name: true
          }
        },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true
          }
        }
      }
    })

    // Получаем завершенные заявки за период
    const completedRequests = await prisma.request.findMany({
      where: {
        ...officeFilter,
        status: 'COMPLETED',
        completedAt: {
          gte: startDate,
          lte: endDate
        }
      },
      include: {
        finance: true,
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
        }
      }
    })

    // Рассчитываем общий оборот
    let totalTurnover = 0

    // Статистика по валютам
    const currencyStats: Record<string, { turnover: number, operationsCount: number }> = {}

    // Добавляем операции к обороту
    for (const operation of operations) {
      const amount = Number(operation.amount)
      totalTurnover += amount

      const currency = operation.currency.code
      if (!currencyStats[currency]) {
        currencyStats[currency] = { turnover: 0, operationsCount: 0 }
      }
      currencyStats[currency].turnover += amount
      currencyStats[currency].operationsCount += 1
    }

    // Добавляем заявки к обороту
    for (const request of completedRequests) {
      if (request.finance?.actualAmountFrom) {
        const amount = Number(request.finance.actualAmountFrom)
        totalTurnover += amount
      }
    }

    // Статистика по офисам
    const officeStats: Record<string, { turnover: number, name: string }> = {}
    
    for (const operation of operations) {
      const officeId = operation.office.id
      const officeName = operation.office.name
      const amount = Number(operation.amount)
      
      if (!officeStats[officeId]) {
        officeStats[officeId] = { turnover: 0, name: officeName }
      }
      officeStats[officeId].turnover += amount
    }

    for (const request of completedRequests) {
      if (request.office && request.finance?.actualAmountFrom) {
        const officeId = request.office.id
        const officeName = request.office.name
        const amount = Number(request.finance.actualAmountFrom)
        
        if (!officeStats[officeId]) {
          officeStats[officeId] = { turnover: 0, name: officeName }
        }
        officeStats[officeId].turnover += amount
      }
    }

    // Статистика по клиентам
    const clientStats: Record<string, { turnover: number, name: string }> = {}
    
    for (const operation of operations) {
      if (operation.client) {
        const clientId = operation.client.id
        const clientName = [operation.client.firstName, operation.client.lastName]
          .filter(Boolean)
          .join(' ') || operation.client.username || 'Неизвестный клиент'
        const amount = Number(operation.amount)
        
        if (!clientStats[clientId]) {
          clientStats[clientId] = { turnover: 0, name: clientName }
        }
        clientStats[clientId].turnover += amount
      }
    }

    for (const request of completedRequests) {
      if (request.client && request.finance?.actualAmountFrom) {
        const clientId = request.client.id
        const clientName = [request.client.firstName, request.client.lastName]
          .filter(Boolean)
          .join(' ') || request.client.username || 'Неизвестный клиент'
        const amount = Number(request.finance.actualAmountFrom)
        
        if (!clientStats[clientId]) {
          clientStats[clientId] = { turnover: 0, name: clientName }
        }
        clientStats[clientId].turnover += amount
      }
    }

    // Дневная динамика
    const dailyStats: Record<string, { turnover: number, operationsCount: number }> = {}
    
    for (const operation of operations) {
      const dateKey = operation.createdAt.toISOString().split('T')[0]
      if (!dailyStats[dateKey]) {
        dailyStats[dateKey] = { turnover: 0, operationsCount: 0 }
      }
      
      const amount = Number(operation.amount)
      dailyStats[dateKey].turnover += amount
      dailyStats[dateKey].operationsCount += 1
    }

    for (const request of completedRequests) {
      if (request.completedAt && request.finance?.actualAmountFrom) {
        const dateKey = request.completedAt.toISOString().split('T')[0]
        if (!dailyStats[dateKey]) {
          dailyStats[dateKey] = { turnover: 0, operationsCount: 0 }
        }
        
        const amount = Number(request.finance.actualAmountFrom)
        dailyStats[dateKey].turnover += amount
        dailyStats[dateKey].operationsCount += 1
      }
    }

    // Преобразуем в массивы и сортируем
    const currencies = Object.entries(currencyStats)
      .map(([currency, stats]) => ({
        currency,
        turnover: stats.turnover,
        operationsCount: stats.operationsCount
      }))
      .sort((a, b) => b.turnover - a.turnover)

    const offices = Object.entries(officeStats)
      .map(([officeId, stats]) => ({
        officeId,
        officeName: stats.name,
        turnover: stats.turnover
      }))
      .sort((a, b) => b.turnover - a.turnover)

    const clients = Object.entries(clientStats)
      .map(([clientId, stats]) => ({
        clientId,
        clientName: stats.name,
        turnover: stats.turnover
      }))
      .sort((a, b) => b.turnover - a.turnover)
      .slice(0, 20) // Топ 20 клиентов

    const dailyTrend = Object.entries(dailyStats)
      .map(([date, stats]) => ({
        date,
        turnover: stats.turnover,
        operationsCount: stats.operationsCount
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    const reportData: TurnoverReportData = {
      period,
      totalTurnover,
      currencies,
      offices,
      clients,
      dailyTrend
    }

    return NextResponse.json<ApiResponse<TurnoverReportData>>({
      success: true,
      data: reportData
    })

  } catch (error) {
    console.error('Error generating turnover report:', error)
    return NextResponse.json<ApiResponse>({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
