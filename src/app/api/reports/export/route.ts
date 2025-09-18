import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse, ExportType, ExportFormat } from '@/lib/types'
import { exportSchema } from '@/lib/types'

// Функция для преобразования данных в CSV
function arrayToCSV(data: any[], headers: string[]): string {
  const csvHeaders = headers.join(',')
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header]
      // Экранируем значения содержащие запятые или кавычки
      if (value === null || value === undefined) return ''
      const stringValue = String(value)
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`
      }
      return stringValue
    }).join(',')
  )
  
  return [csvHeaders, ...csvRows].join('\n')
}

// GET /api/reports/export - Экспорт данных
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
    
    // Парсим параметры
    const params = {
      type: searchParams.get('type') as ExportType,
      format: (searchParams.get('format') || 'csv') as ExportFormat,
      dateFrom: searchParams.get('dateFrom'),
      dateTo: searchParams.get('dateTo'),
      filters: searchParams.get('filters') ? JSON.parse(searchParams.get('filters')!) : undefined,
    }

    // Валидируем параметры
    const validationResult = exportSchema.safeParse(params)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные параметры экспорта',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const { type, format, dateFrom, dateTo, filters } = validationResult.data

    // Проверяем права доступа
    if (type === 'users' && payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    // Построим базовые условия фильтрации
    let baseWhere: any = {}

    if (dateFrom && dateTo) {
      baseWhere.createdAt = {
        gte: new Date(dateFrom),
        lte: new Date(dateTo),
      }
    }

    // Применяем RBAC фильтры для кассиров
    if (payload.role === UserRole.CASHIER && payload.officeIds) {
      if (type === 'requests') {
        baseWhere.officeId = { in: payload.officeIds }
      }
    }

    let data: any[] = []
    let headers: string[] = []
    let filename = ''

    // Получаем данные в зависимости от типа экспорта
    switch (type) {
      case 'requests':
        data = await prisma.request.findMany({
          where: { ...baseWhere, ...filters },
          include: {
            client: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
                phone: true,
              },
            },
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
          },
          orderBy: { createdAt: 'desc' },
          take: 10000, // Лимит для предотвращения перегрузки
        })

        headers = [
          'requestId', 'status', 'direction', 'createdAt', 'completedAt',
          'clientName', 'clientPhone', 'officeName', 'assignedUserName',
          'fromCurrency', 'toCurrency', 'expectedAmountFrom', 'expectedAmountTo',
          'commissionPercent'
        ]

        data = data.map(req => ({
          requestId: req.requestId,
          status: req.status,
          direction: req.direction,
          createdAt: req.createdAt.toISOString(),
          completedAt: req.completedAt?.toISOString() || '',
          clientName: `${req.client.firstName || ''} ${req.client.lastName || ''}`.trim(),
          clientPhone: req.client.phone || '',
          officeName: req.office?.name || '',
          assignedUserName: req.assignedUser ? 
            `${req.assignedUser.firstName} ${req.assignedUser.lastName || ''}`.trim() : '',
          fromCurrency: req.finance?.fromCurrency || '',
          toCurrency: req.finance?.toCurrency || '',
          expectedAmountFrom: req.finance?.expectedAmountFrom || 0,
          expectedAmountTo: req.finance?.expectedAmountTo || 0,
          commissionPercent: req.finance?.commissionPercent || 0,
        }))

        filename = `requests_export_${new Date().toISOString().split('T')[0]}`
        break

      case 'clients':
        data = await prisma.client.findMany({
          where: { ...baseWhere, ...filters },
          include: {
            _count: {
              select: {
                requests: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 10000,
        })

        headers = [
          'telegramUserId', 'username', 'firstName', 'lastName', 'phone',
          'totalRequests', 'totalVolume', 'isBlocked', 'createdAt', 'lastContactDate'
        ]

        data = data.map(client => ({
          telegramUserId: client.telegramUserId,
          username: client.username || '',
          firstName: client.firstName || '',
          lastName: client.lastName || '',
          phone: client.phone || '',
          totalRequests: client.totalRequests,
          totalVolume: client.totalVolume || 0,
          isBlocked: client.isBlocked,
          createdAt: client.createdAt.toISOString(),
          lastContactDate: client.lastContactDate?.toISOString() || '',
        }))

        filename = `clients_export_${new Date().toISOString().split('T')[0]}`
        break

      case 'offices':
        // Только для админов
        if (payload.role !== UserRole.ADMIN) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Доступ запрещен' },
            { status: 403 }
          )
        }

        data = await prisma.office.findMany({
          where: { ...baseWhere, ...filters },
          include: {
            _count: {
              select: {
                requests: true,
                accounts: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        })

        headers = [
          'name', 'city', 'address', 'phone', 'email',
          'isActive', 'createdAt', 'requestsCount', 'accountsCount'
        ]

        data = data.map(office => ({
          name: office.name,
          city: office.city,
          address: office.address,
          phone: office.phone || '',
          email: office.email || '',
          isActive: office.isActive,
          createdAt: office.createdAt.toISOString(),
          requestsCount: office._count.requests,
          accountsCount: office._count.accounts,
        }))

        filename = `offices_export_${new Date().toISOString().split('T')[0]}`
        break

      case 'users':
        // Только для админов
        if (payload.role !== UserRole.ADMIN) {
          return NextResponse.json<ApiResponse>(
            { success: false, error: 'Доступ запрещен' },
            { status: 403 }
          )
        }

        data = await prisma.user.findMany({
          where: { ...baseWhere, ...filters },
          select: {
            username: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            officeIds: true,
            isActive: true,
            createdAt: true,
            _count: {
              select: {
                assignedRequests: true,
              },
            },
          },
          orderBy: { firstName: 'asc' },
        })

        headers = [
          'username', 'firstName', 'lastName', 'email', 'role',
          'officeIds', 'isActive', 'createdAt', 'assignedRequestsCount'
        ]

        data = data.map(user => ({
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName || '',
          email: user.email || '',
          role: user.role,
          officeIds: user.officeIds.join(';'),
          isActive: user.isActive,
          createdAt: user.createdAt.toISOString(),
          assignedRequestsCount: user._count.assignedRequests,
        }))

        filename = `users_export_${new Date().toISOString().split('T')[0]}`
        break

      default:
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Неподдерживаемый тип экспорта' },
          { status: 400 }
        )
    }

    // Обрабатываем формат экспорта
    let content: string
    let contentType: string
    let fileExtension: string

    switch (format) {
      case 'csv':
        content = arrayToCSV(data, headers)
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
        break

      case 'excel':
        // Для Excel можно использовать CSV с BOM для корректного отображения в Excel
        content = '\uFEFF' + arrayToCSV(data, headers)
        contentType = 'application/vnd.ms-excel; charset=utf-8'
        fileExtension = 'csv'
        break

      case 'pdf':
        // Для PDF нужна дополнительная библиотека (jsPDF, PDFKit)
        // Пока возвращаем CSV
        content = arrayToCSV(data, headers)
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
        break

      default:
        content = arrayToCSV(data, headers)
        contentType = 'text/csv; charset=utf-8'
        fileExtension = 'csv'
    }

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: payload.userId,
        entityType: 'export',
        entityId: `${type}_${format}`,
        action: 'export',
        newValues: {
          type,
          format,
          recordsCount: data.length,
          dateFrom,
          dateTo,
        } as any,
      },
    })

    // Возвращаем файл
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}.${fileExtension}"`,
        'Cache-Control': 'no-cache',
      },
    })

  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}