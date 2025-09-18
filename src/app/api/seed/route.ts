import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, UserRole, RequestStatus, OperationDirection, NetworkType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Проверяем что это запрос только для development/первого запуска
    const { authorization } = Object.fromEntries(request.headers.entries())
    
    // Простая защита - должен быть определенный заголовок
    if (authorization !== 'Bearer seed-database-token') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🌱 Начинаем заполнение базы данных...')

    // Создаем демо-офисы
    const office1 = await prisma.office.upsert({
      where: { id: 'office-001' },
      update: {},
      create: {
        id: 'office-001',
        name: 'Главный офис',
        city: 'Москва',
        address: 'ул. Тверская, 1',
        phone: '+7 (495) 123-45-67',
        email: 'main@crypto-exchange.ru',
        activeCurrencies: ['USDT', 'BTC', 'ETH', 'TRY'],
        activeNetworks: ['ETH', 'TRON', 'BSC', 'TON'],
        isActive: true,
      },
    })

    const office2 = await prisma.office.upsert({
      where: { id: 'office-002' },
      update: {},
      create: {
        id: 'office-002',
        name: 'Офис на Арбате',
        city: 'Москва',
        address: 'ул. Арбат, 15',
        phone: '+7 (495) 987-65-43',
        email: 'arbat@crypto-exchange.ru',
        activeCurrencies: ['USDT', 'BTC', 'TRY'],
        activeNetworks: ['TRON', 'BSC'],
        isActive: true,
      },
    })

    console.log('✅ Офисы созданы')

    // Создаем пользователей
    const hashedAdminPassword = await bcrypt.hash('admin123', 12)
    const hashedCashierPassword = await bcrypt.hash('cashier123', 12)

    const admin = await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        id: 'user-admin',
        username: 'admin',
        email: 'admin@crypto-exchange.ru',
        firstName: 'Администратор',
        lastName: 'Системы',
        role: UserRole.ADMIN,
        officeIds: [office1.id, office2.id],
        isActive: true,
        password: hashedAdminPassword,
      },
    })

    const cashier1 = await prisma.user.upsert({
      where: { username: 'cashier1' },
      update: {},
      create: {
        id: 'user-cashier-1',
        username: 'cashier1',
        email: 'cashier1@crypto-exchange.ru',
        firstName: 'Иван',
        lastName: 'Иванов',
        role: UserRole.CASHIER,
        officeIds: [office1.id],
        isActive: true,
        password: hashedCashierPassword,
      },
    })

    const cashier2 = await prisma.user.upsert({
      where: { username: 'cashier2' },
      update: {},
      create: {
        id: 'user-cashier-2',
        username: 'cashier2',
        email: 'cashier2@crypto-exchange.ru',
        firstName: 'Мария',
        lastName: 'Петрова',
        role: UserRole.CASHIER,
        officeIds: [office2.id],
        isActive: true,
        password: hashedCashierPassword,
      },
    })

    console.log('✅ Пользователи созданы')

    // Создаем демо-клиентов
    const client1 = await prisma.client.upsert({
      where: { telegramUserId: '123456789' },
      update: {},
      create: {
        telegramUserId: '123456789',
        username: 'demo_user_1',
        firstName: 'Дмитрий',
        lastName: 'Сидоров',
        phone: '+7 (999) 123-45-67',
        tags: ['VIP', 'high-volume'],
        isBlocked: false,
        totalRequests: 15,
        totalVolume: 25000,
      },
    })

    const client2 = await prisma.client.upsert({
      where: { telegramUserId: '987654321' },
      update: {},
      create: {
        telegramUserId: '987654321',
        username: 'demo_user_2',
        firstName: 'Анна',
        lastName: 'Козлова',
        tags: ['regular'],
        isBlocked: false,
        totalRequests: 3,
        totalVolume: 1500,
      },
    })

    console.log('✅ Клиенты созданы')

    return NextResponse.json({
      success: true,
      message: 'База данных успешно заполнена!',
      users: [
        { username: 'admin', password: 'admin123', role: 'ADMIN' },
        { username: 'cashier1', password: 'cashier123', role: 'CASHIER' },
        { username: 'cashier2', password: 'cashier123', role: 'CASHIER' },
      ],
    })
  } catch (error) {
    console.error('❌ Ошибка при заполнении базы данных:', error)
    return NextResponse.json(
      { 
        error: 'Ошибка при заполнении базы данных',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
