import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Получаем последние курсы для каждой валюты
    const rates = await prisma.exchangeRate.findMany({
      where: {
        isActive: true,
      },
      include: {
        currency: true,
      },
      orderBy: [
        { currency: { code: 'asc' } },
        { rateDate: 'desc' },
      ],
    });

    // Группируем по валютам и берем только последний курс для каждой
    const latestRates = rates.reduce((acc, rate) => {
      if (!acc[rate.currencyId]) {
        acc[rate.currencyId] = rate;
      }
      return acc;
    }, {} as Record<string, any>);

    const result = Object.values(latestRates);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching exchange rates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
