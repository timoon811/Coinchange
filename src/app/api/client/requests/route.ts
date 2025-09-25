import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { calculateSLADeadline, ClientPriority } from '@/lib/sla-config';

const createClientRequestSchema = z.object({
  direction: z.enum(['CRYPTO_TO_CASH', 'CASH_TO_CRYPTO', 'CARD_TO_CRYPTO', 'CRYPTO_TO_CARD', 'CARD_TO_CASH', 'CASH_TO_CARD']),
  fromCurrency: z.string().min(1),
  toCurrency: z.string().min(1),
  fromAmount: z.number().positive(),
  toAmount: z.number().positive().optional(),
  walletAddress: z.string().optional(),
  clientId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('clientId');

    if (!clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    const requests = await prisma.request.findMany({
      where: {
        clientId,
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
            username: true,
          },
        },
        office: {
          select: {
            name: true,
          },
        },
        finance: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    console.error('Error fetching client requests:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      direction,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      walletAddress,
      clientId,
    } = body;

    // Валидация данных
    const validationResult = createClientRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    // Проверяем существование клиента
    const client = await prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      return NextResponse.json(
        { success: false, error: 'Client not found' },
        { status: 404 }
      );
    }

    // Вычисляем SLA дедлайн автоматически
    const slaDeadline = calculateSLADeadline(
      direction as any,
      fromAmount,
      fromCurrency,
      ClientPriority.NORMAL // TODO: определять из профиля клиента
    )

    // Создаем заявку в транзакции
    const result = await prisma.$transaction(async (tx) => {
      // Создаем заявку
      const newRequest = await tx.request.create({
        data: {
          requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
          clientId,
          direction: direction as any,
          status: 'NEW',
          source: 'web',
          locale: 'ru',
          slaDeadline,
        },
        include: {
          client: {
            select: {
              firstName: true,
              lastName: true,
              username: true,
            },
          },
          office: {
            select: {
              name: true,
            },
          },
        },
      });

      // Создаем финансовую информацию
      const finance = await tx.requestFinance.create({
        data: {
          requestId: newRequest.id,
          fromCurrency,
          toCurrency,
          expectedAmountFrom: fromAmount,
          expectedAmountTo: toAmount,
        },
      });

      // Создаем реквизиты если есть адрес кошелька
      let requisites = null;
      if (walletAddress) {
        requisites = await tx.requisites.create({
          data: {
            requestId: newRequest.id,
            walletAddress: walletAddress, // В реальном приложении нужно зашифровать
          },
        });
      }

      // Обновляем статистику клиента
      await tx.client.update({
        where: { id: clientId },
        data: {
          totalRequests: { increment: 1 },
          lastContactDate: new Date(),
        },
      });

      return {
        ...newRequest,
        finance,
        requisites,
      };
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: 'Заявка успешно создана',
    });
  } catch (error) {
    console.error('Error creating client request:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
