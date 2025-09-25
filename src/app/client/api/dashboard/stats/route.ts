import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Получаем статистику
    const [
      totalRequests,
      totalVolume,
      averageTime,
      activeUsers,
    ] = await Promise.all([
      // Общее количество заявок
      prisma.request.count({
        where: {
          status: 'COMPLETED',
        },
      }),
      
      // Общий объем
      prisma.requestFinance.aggregate({
        _sum: {
          actualAmountFrom: true,
        },
        where: {
          request: {
            status: 'COMPLETED',
          },
        },
      }),
      
      // Среднее время обработки (в минутах)
      prisma.request.aggregate({
        _avg: {
          // Предполагаем, что есть поле для времени обработки
          // В реальном приложении нужно добавить это поле
        },
        where: {
          status: 'COMPLETED',
        },
      }),
      
      // Активные пользователи (за последние 24 часа)
      prisma.client.count({
        where: {
          lastContactDate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    const stats = {
      totalVolume: totalVolume._sum.actualAmountFrom || 0,
      totalRequests,
      averageTime: 15, // Заглушка, в реальном приложении нужно вычислять
      activeUsers,
    };

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
