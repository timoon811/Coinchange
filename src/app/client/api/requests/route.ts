import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
    console.error('Error fetching requests:', error);
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

    if (!clientId || !direction || !fromCurrency || !toCurrency || !fromAmount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Создаем заявку
    const newRequest = await prisma.request.create({
      data: {
        requestId: `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        clientId,
        direction: direction as any,
        status: 'NEW',
        source: 'web',
        locale: 'ru',
      },
    });

    // Создаем финансовую информацию
    await prisma.requestFinance.create({
      data: {
        requestId: newRequest.id,
        fromCurrency,
        toCurrency,
        expectedAmountFrom: fromAmount,
        expectedAmountTo: toAmount,
      },
    });

    // Создаем реквизиты если есть адрес кошелька
    if (walletAddress) {
      await prisma.requisites.create({
        data: {
          requestId: newRequest.id,
          walletAddress: walletAddress, // В реальном приложении нужно зашифровать
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: newRequest,
    });
  } catch (error) {
    console.error('Error creating request:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
