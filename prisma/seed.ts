import { PrismaClient, UserRole, RequestStatus, OperationDirection, NetworkType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { seedAccountingData } from './seed-accounting'

const prisma = new PrismaClient()

async function main() {
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

  // Создаем демо-заявки
  const request1 = await prisma.request.upsert({
    where: { requestId: 'tg-001' },
    update: {},
    create: {
      requestId: 'tg-001',
      clientId: client1.id,
      officeId: office1.id,
      assignedUserId: cashier1.id,
      direction: OperationDirection.CRYPTO_TO_CASH,
      status: RequestStatus.ASSIGNED,
      source: 'telegram',
      locale: 'ru',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 часа назад
      slaDeadline: new Date(Date.now() + 2 * 60 * 60 * 1000), // Через 2 часа
    },
  })

  const request2 = await prisma.request.upsert({
    where: { requestId: 'tg-002' },
    update: {},
    create: {
      requestId: 'tg-002',
      clientId: client2.id,
      officeId: office2.id,
      direction: OperationDirection.CASH_TO_CRYPTO,
      status: RequestStatus.NEW,
      source: 'telegram',
      locale: 'ru',
      createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 минут назад
      slaDeadline: new Date(Date.now() + 30 * 60 * 1000), // Через 30 минут
    },
  })

  console.log('✅ Заявки созданы')

  // Создаем финансовую информацию для заявок
  await prisma.requestFinance.upsert({
    where: { requestId: request1.id },
    update: {},
    create: {
      requestId: request1.id,
      fromCurrency: 'USDT',
      fromNetwork: NetworkType.TRON,
      toCurrency: 'TRY',
      expectedAmountFrom: 1000,
      expectedAmountTo: 26500,
      rateValue: 26.5,
      commissionPercent: 1.5,
    },
  })

  await prisma.requestFinance.upsert({
    where: { requestId: request2.id },
    update: {},
    create: {
      requestId: request2.id,
      fromCurrency: 'TRY',
      toCurrency: 'USDT',
      fromNetwork: NetworkType.TRON,
      expectedAmountFrom: 10000,
      expectedAmountTo: 377,
      rateValue: 0.0377,
      commissionPercent: 1.0,
    },
  })

  console.log('✅ Финансовая информация создана')

  // Создаем демо-реквизиты
  await prisma.requisites.upsert({
    where: { requestId: request1.id },
    update: {},
    create: {
      requestId: request1.id,
      walletAddress: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuW5', // Зашифровано будет при сохранении
      cardMasked: '**** **** **** 1234',
      bankName: 'Sberbank',
    },
  })

  await prisma.requisites.upsert({
    where: { requestId: request2.id },
    update: {},
    create: {
      requestId: request2.id,
      walletAddress: 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuW6', // Зашифровано будет при сохранении
    },
  })

  console.log('✅ Реквизиты созданы')

  // Создаем демо-комментарии
  await prisma.comment.createMany({
    data: [
      {
        requestId: request1.id,
        authorId: admin.id,
        text: 'Клиент просил без сдачи, подготовить точную сумму',
        isInternal: true,
      },
      {
        requestId: request1.id,
        authorId: cashier1.id,
        text: 'Подтверждение получено, ожидаю клиента в офисе',
        isInternal: false,
      },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Комментарии созданы')

  // Создаем демо-уведомления
  await prisma.notification.createMany({
    data: [
      {
        userId: cashier1.id,
        type: 'NEW_REQUEST' as const,
        title: 'Новая заявка',
        message: 'Получена новая заявка от Дмитрия Сидорова',
        payload: { requestId: request1.id },
      },
      {
        userId: cashier2.id,
        type: 'NEW_REQUEST' as const,
        title: 'Новая заявка',
        message: 'Получена новая заявка от Анны Козловой',
        payload: { requestId: request2.id },
      },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Уведомления созданы')

  console.log('🎉 База данных успешно заполнена демо-данными!')
  // Заполняем данные системы учета
  await seedAccountingData()

  console.log('')
  console.log('📋 Учетные данные для входа:')
  console.log('Администратор: admin / admin123')
  console.log('Кассир 1: cashier1 / cashier123')
  console.log('Кассир 2: cashier2 / cashier123')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
