import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const currencies = await prisma.currency.findMany({
      where: {
        isActive: true,
      },
      orderBy: [
        { type: 'asc' },
        { code: 'asc' },
      ],
    });

    return NextResponse.json({
      success: true,
      data: currencies,
    });
  } catch (error) {
    console.error('Error fetching currencies:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
