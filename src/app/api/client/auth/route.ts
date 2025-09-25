import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { telegramUserId, username, firstName, lastName, phone } = body;

    if (!telegramUserId) {
      return NextResponse.json(
        { error: 'Telegram ID is required' },
        { status: 400 }
      );
    }

    // Ищем существующего клиента или создаем нового
    let client = await prisma.client.findUnique({
      where: { telegramUserId },
    });

    if (!client) {
      // Создаем нового клиента
      client = await prisma.client.create({
        data: {
          telegramUserId,
          username: username || null,
          firstName: firstName || null,
          lastName: lastName || null,
          phone: phone || null,
          totalRequests: 0,
          totalVolume: 0,
          isBlocked: false,
        },
      });
    } else {
      // Обновляем существующего клиента
      client = await prisma.client.update({
        where: { telegramUserId },
        data: {
          username: username || client.username,
          firstName: firstName || client.firstName,
          lastName: lastName || client.lastName,
          phone: phone || client.phone,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        id: client.id,
        telegramUserId: client.telegramUserId,
        username: client.username,
        firstName: client.firstName,
        lastName: client.lastName,
        phone: client.phone,
        totalRequests: client.totalRequests,
        totalVolume: client.totalVolume,
        isBlocked: client.isBlocked,
      },
    });
  } catch (error) {
    console.error('Client auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
