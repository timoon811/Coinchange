import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { EncryptionService } from '@/lib/encryption'
import {
  UserRole,
  RequestStatus,
  OperationDirection,
  NetworkType,
  AttachmentType
} from '@prisma/client'
import type { TelegramWebhookPayload, ApiResponse } from '@/lib/types'
import { getMimeTypeByExtension, getFileSizeFromUrl } from '@/lib/file-utils'

// TelegramWebhookPayload импортирован из @/lib/types

// Маппинг направлений операций
const directionMap = {
  CryptoToCash: OperationDirection.CRYPTO_TO_CASH,
  CashToCrypto: OperationDirection.CASH_TO_CRYPTO,
  CardToCrypto: OperationDirection.CARD_TO_CRYPTO,
  CryptoToCard: OperationDirection.CRYPTO_TO_CARD,
  CardToCash: OperationDirection.CARD_TO_CASH,
  CashToCard: OperationDirection.CASH_TO_CARD,
}

// Маппинг типов вложений
const attachmentTypeMap = {
  receipt: AttachmentType.RECEIPT,
  screenshot: AttachmentType.SCREENSHOT,
  document: AttachmentType.DOCUMENT,
}

export async function POST(request: NextRequest) {
  try {
    const payload: TelegramWebhookPayload = await request.json()

    // Логируем входящий запрос
    console.log('📨 Telegram webhook received:', {
      requestId: payload.request_id,
      clientId: payload.client.telegram_user_id,
      direction: payload.operation.direction,
      amount: payload.operation.expected_amount_from,
    })

    // Проверяем обязательные поля
    if (!payload.request_id || !payload.client?.telegram_user_id || !payload.operation) {
      console.error('❌ Invalid payload structure')
      return NextResponse.json(
        { error: 'Invalid payload structure' },
        { status: 400 }
      )
    }

    // Проверяем дубликат заявки (idempotency)
    const existingRequest = await prisma.request.findUnique({
      where: { requestId: payload.request_id },
    })

    if (existingRequest) {
      console.log('⚠️ Duplicate request detected, returning existing data')
      return NextResponse.json({
        success: true,
        request_id: existingRequest.requestId,
        status: existingRequest.status,
        message: 'Request already exists',
      })
    }

    // Создаем или обновляем клиента
    const client = await prisma.client.upsert({
      where: {
        telegramUserId: payload.client.telegram_user_id.toString(),
      },
      update: {
        username: payload.client.username,
        firstName: payload.client.first_name,
        lastName: payload.client.last_name,
        phone: payload.client.phone,
        languageCode: payload.client.language_code,
        updatedAt: new Date(),
      },
      create: {
        telegramUserId: payload.client.telegram_user_id.toString(),
        username: payload.client.username,
        firstName: payload.client.first_name,
        lastName: payload.client.last_name,
        phone: payload.client.phone,
        languageCode: payload.client.language_code,
        tags: [],
        isBlocked: false,
        totalRequests: 0,
        totalVolume: 0,
      },
    })

    // Определяем офис назначения
    let officeId = payload.requisites?.office_id

    // Если офис не указан, находим ближайший активный офис
    if (!officeId) {
      const defaultOffice = await prisma.office.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'asc' },
      })
      officeId = defaultOffice?.id
    }

    // Создаем заявку
    const requestRecord = await prisma.request.create({
      data: {
        requestId: payload.request_id,
        clientId: client.id,
        officeId: officeId,
        direction: directionMap[payload.operation.direction],
        status: RequestStatus.NEW,
        source: payload.meta?.source || 'telegram',
        locale: payload.meta?.locale || 'ru',
        slaDeadline: payload.operation.rate_locked_ttl_sec
          ? new Date(Date.now() + payload.operation.rate_locked_ttl_sec * 1000)
          : null,
      },
    })

    // Создаем финансовую информацию
    await prisma.requestFinance.create({
      data: {
        requestId: requestRecord.id,
        fromCurrency: payload.operation.from_currency,
        fromNetwork: payload.operation.from_network ? NetworkType[payload.operation.from_network as keyof typeof NetworkType] : null,
        toCurrency: payload.operation.to_currency,
        expectedAmountFrom: payload.operation.expected_amount_from,
        expectedAmountTo: payload.operation.expected_amount_to,
        rateLocked: !!payload.operation.rate_locked_ttl_sec,
        rateLockedUntil: payload.operation.rate_locked_ttl_sec
          ? new Date(Date.now() + payload.operation.rate_locked_ttl_sec * 1000)
          : null,
      },
    })

    // Создаем реквизиты (с шифрованием чувствительных данных)
    if (payload.requisites) {
      await prisma.requisites.create({
        data: {
          requestId: requestRecord.id,
          walletAddress: payload.requisites.wallet_address
            ? EncryptionService.encrypt(payload.requisites.wallet_address)
            : null,
          cardNumber: payload.requisites.card_number
            ? EncryptionService.encrypt(payload.requisites.card_number)
            : null,
          cardMasked: payload.requisites.card_masked,
          bankName: payload.requisites.bank_name,
          extraData: payload.requisites.extra_data as any,
        },
      })
    }

    // Создаем вложения
    if (payload.attachments && payload.attachments.length > 0) {
      const attachmentsData = await Promise.all(
        payload.attachments.map(async (attachment) => {
          const fileSize = await getFileSizeFromUrl(attachment.url)
          const mimeType = getMimeTypeByExtension(attachment.filename)
          
          return {
            requestId: requestRecord.id,
            filename: attachment.filename,
            originalName: attachment.filename,
            fileUrl: attachment.url,
            fileSize,
            mimeType,
            type: attachmentTypeMap[attachment.type],
            uploadedBy: 'system', // Будет заменено на ID после создания системных пользователей
          }
        })
      )

      await prisma.attachment.createMany({
        data: attachmentsData,
      })
    }

    // Создаем комментарий если есть
    if (payload.comment) {
      await prisma.comment.create({
        data: {
          requestId: requestRecord.id,
          authorId: 'system', // Будет заменено на ID после создания системных пользователей
          text: payload.comment,
          isInternal: false,
        },
      })
    }

    // Создаем запись в аудите
    await prisma.auditLog.create({
      data: {
        actorId: 'system', // Будет заменено на ID после создания системных пользователей
        entityType: 'request',
        entityId: requestRecord.id,
        action: 'create',
        newValues: payload as any,
      },
    })

    // Обновляем статистику клиента
    await prisma.client.update({
      where: { id: client.id },
      data: {
        totalRequests: { increment: 1 },
        totalVolume: {
          increment: payload.operation.expected_amount_from,
        },
      },
    })

    // Создаем уведомления для кассиров офиса
    if (officeId) {
      const cashiers = await prisma.user.findMany({
        where: {
          role: UserRole.CASHIER,
          officeIds: { has: officeId },
          isActive: true,
        },
      })

      if (cashiers.length > 0) {
        await prisma.notification.createMany({
          data: cashiers.map(cashier => ({
            userId: cashier.id,
            type: 'NEW_REQUEST' as const,
            title: 'Новая заявка',
            message: `Получена новая заявка от ${client.firstName || 'клиента'}`,
            payload: {
              requestId: requestRecord.id,
              clientName: client.firstName,
              amount: payload.operation.expected_amount_from,
              currency: payload.operation.from_currency,
            },
          })),
        })
      }
    }

    console.log('✅ Request created successfully:', requestRecord.id)

    // Возвращаем успешный ответ
    return NextResponse.json({
      success: true,
      request_id: requestRecord.requestId,
      status: requestRecord.status,
      message: 'Request created successfully',
      assigned_office: officeId,
    })

  } catch (error) {
    console.error('❌ Telegram webhook error:', error)

    // Логируем ошибку в аудит
    try {
      await prisma.auditLog.create({
        data: {
          actorId: 'system',
          entityType: 'webhook',
          entityId: 'telegram',
          action: 'error',
          oldValues: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      })
    } catch (auditError) {
      console.error('Failed to log audit error:', auditError)
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Обработка предварительных запросов (CORS)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Telegram-Bot-Api-Secret-Token',
    },
  })
}
