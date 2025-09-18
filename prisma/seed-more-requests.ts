import { PrismaClient, RequestStatus, OperationDirection, NetworkType, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Создание дополнительных тестовых заявок...')

  // Получаем существующих клиентов и офисы
  const clients = await prisma.client.findMany({ take: 10 })
  const offices = await prisma.office.findMany()
  const users = await prisma.user.findMany({ 
    where: { 
      role: UserRole.CASHIER,
      isActive: true 
    } 
  })

  if (clients.length === 0 || offices.length === 0) {
    console.log('❌ Сначала нужно создать клиентов и офисы')
    return
  }

  const currencies = ['BTC', 'ETH', 'USDT', 'LTC', 'BNB', 'ADA', 'XRP', 'DOGE', 'MATIC', 'SOL']
  const statuses = Object.values(RequestStatus)
  const directions = Object.values(OperationDirection)

  // Создаем 50 дополнительных заявок
  for (let i = 0; i < 50; i++) {
    const client = clients[Math.floor(Math.random() * clients.length)]
    const office = offices[Math.floor(Math.random() * offices.length)]
    const status = statuses[Math.floor(Math.random() * statuses.length)]
    const direction = directions[Math.floor(Math.random() * directions.length)]
    const fromCurrency = currencies[Math.floor(Math.random() * currencies.length)]
    const toCurrency = currencies[Math.floor(Math.random() * currencies.length)]
    
    // Случайная дата в пределах последних 30 дней
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - Math.floor(Math.random() * 30))
    
    const expectedAmountFrom = 100 + Math.random() * 10000
    const rateValue = 0.8 + Math.random() * 0.4 // От 0.8 до 1.2
    const expectedAmountTo = expectedAmountFrom * rateValue
    const commissionPercent = 1 + Math.random() * 4 // От 1% до 5%

    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${i}`

    const request = await prisma.request.create({
      data: {
        requestId,
        clientId: client.id,
        officeId: office.id,
        assignedUserId: users.length > 0 ? users[Math.floor(Math.random() * users.length)].id : undefined,
        direction,
        status,
        source: Math.random() > 0.5 ? 'telegram' : 'manual',
        createdAt,
        updatedAt: createdAt,
        assignedAt: status !== RequestStatus.NEW ? createdAt : undefined,
        completedAt: status === RequestStatus.COMPLETED ? new Date(createdAt.getTime() + Math.random() * 24 * 60 * 60 * 1000) : undefined,
        slaDeadline: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000), // 24 часа
      },
    })

    // Создаем финансовую информацию
    await prisma.requestFinance.create({
      data: {
        requestId: request.id,
        fromCurrency,
        fromNetwork: Math.random() > 0.5 ? NetworkType.MAINNET : NetworkType.TESTNET,
        toCurrency,
        expectedAmountFrom,
        expectedAmountTo,
        rateValue,
        commissionPercent,
      },
    })

    // Создаем реквизиты
    await prisma.requisites.create({
      data: {
        requestId: request.id,
        walletAddress: direction === OperationDirection.CRYPTO_TO_FIAT ? 
          `${fromCurrency.toLowerCase()}1${Math.random().toString(36).substring(2, 30)}` : undefined,
        cardNumber: direction === OperationDirection.FIAT_TO_CRYPTO ? 
          `****-****-****-${Math.floor(1000 + Math.random() * 9000)}` : undefined,
        cardMasked: direction === OperationDirection.FIAT_TO_CRYPTO ? 
          `****-****-****-${Math.floor(1000 + Math.random() * 9000)}` : undefined,
        bankName: direction === OperationDirection.FIAT_TO_CRYPTO ? 
          ['Сбербанк', 'ВТБ', 'Альфа-Банк', 'Тинькофф'][Math.floor(Math.random() * 4)] : undefined,
      },
    })

    // Добавляем случайные комментарии
    if (Math.random() > 0.7) {
      const comments = [
        'Клиент подтвердил реквизиты',
        'Ожидаем поступления средств',
        'Средства получены, обрабатываем',
        'Заявка выполнена успешно',
        'Требуется дополнительная проверка',
        'Клиент запросил изменение суммы',
        'Уточняем курс валют',
        'Готово к выплате'
      ]
      
      await prisma.comment.create({
        data: {
          requestId: request.id,
          authorId: users.length > 0 ? users[Math.floor(Math.random() * users.length)].id : client.id,
          text: comments[Math.floor(Math.random() * comments.length)],
          isInternal: Math.random() > 0.5,
        },
      })
    }

    // Обновляем статистику клиента
    await prisma.client.update({
      where: { id: client.id },
      data: {
        totalRequests: { increment: 1 },
        totalVolume: { increment: expectedAmountFrom },
        lastContactDate: createdAt,
      },
    })

    if ((i + 1) % 10 === 0) {
      console.log(`✅ Создано ${i + 1} заявок из 50`)
    }
  }

  console.log('🎉 Дополнительные тестовые заявки созданы!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
