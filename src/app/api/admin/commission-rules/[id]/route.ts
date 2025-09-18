import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'
import type { AuthenticatedPayload, ApiResponse } from '@/lib/types'
import { z } from 'zod'

// Схема валидации для обновления правила комиссии
const commissionRuleUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  scope: z.enum(['global', 'office', 'client', 'direction', 'amount_range']).optional(),
  conditions: z.any().optional(),
  percent: z.number().min(0).max(100).optional(),
  fixed: z.number().min(0).optional(),
  priority: z.number().int().optional(),
  isActive: z.boolean().optional(),
})

// GET /api/admin/commission-rules/[id] - Получить правило комиссии
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Проверяем права администратора
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    // Получаем правило комиссии
    const rule = await prisma.commissionRule.findUnique({
      where: { id },
    })

    if (!rule) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Правило комиссии не найдено' },
        { status: 404 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: rule,
    })

  } catch (error) {
    console.error('Get commission rule error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// PATCH /api/admin/commission-rules/[id] - Обновить правило комиссии
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Проверяем права администратора
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    // Проверяем существование правила
    const existingRule = await prisma.commissionRule.findUnique({
      where: { id },
    })

    if (!existingRule) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Правило комиссии не найдено' },
        { status: 404 }
      )
    }

    // Парсим данные
    let body
    try {
      body = await request.json()
    } catch (error) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Неверный формат JSON' },
        { status: 400 }
      )
    }

    // Валидируем данные
    const validationResult = commissionRuleUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Неверные данные для обновления',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      )
    }

    const updateData = validationResult.data

    // Проверяем что не удаляются все виды комиссии
    const newPercent = updateData.percent !== undefined ? updateData.percent : existingRule.percent
    const newFixed = updateData.fixed !== undefined ? updateData.fixed : existingRule.fixed

    if (!newPercent && !newFixed) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Необходимо указать процентную или фиксированную комиссию' },
        { status: 400 }
      )
    }

    // Обновляем правило в транзакции
    const result = await prisma.$transaction(async (tx) => {
      const updatedRule = await tx.commissionRule.update({
        where: { id },
        data: updateData,
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'commission_rule',
          entityId: id,
          action: 'update',
          oldValues: {
            name: existingRule.name,
            percent: existingRule.percent,
            fixed: existingRule.fixed,
            isActive: existingRule.isActive,
          } as any,
          newValues: updateData as any,
        },
      })

      return updatedRule
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Правило комиссии успешно обновлено',
    })

  } catch (error) {
    console.error('Update commission rule error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/commission-rules/[id] - Удалить правило комиссии
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

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

    // Проверяем права администратора
    if (payload.role !== UserRole.ADMIN) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Доступ запрещен. Требуются права администратора.' },
        { status: 403 }
      )
    }

    // Проверяем существование правила
    const rule = await prisma.commissionRule.findUnique({
      where: { id },
    })

    if (!rule) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Правило комиссии не найдено' },
        { status: 404 }
      )
    }

    // Удаляем правило в транзакции
    const result = await prisma.$transaction(async (tx) => {
      await tx.commissionRule.delete({
        where: { id },
      })

      // Создаем запись в аудите
      await tx.auditLog.create({
        data: {
          actorId: payload.userId,
          entityType: 'commission_rule',
          entityId: id,
          action: 'delete',
          oldValues: {
            name: rule.name,
            scope: rule.scope,
            percent: rule.percent,
            fixed: rule.fixed,
          } as any,
        },
      })

      return { id }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: result,
      message: 'Правило комиссии удалено',
    })

  } catch (error) {
    console.error('Delete commission rule error:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    )
  }
}