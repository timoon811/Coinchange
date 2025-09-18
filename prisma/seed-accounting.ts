import { PrismaClient, CurrencyType, AccountType, OperationType, DepositType } from '@prisma/client'

const prisma = new PrismaClient()

export async function seedAccountingData() {
  console.log('🏦 Заполнение данных системы учета...')

  // Создаем базовые валюты
  const currencies = await Promise.all([
    prisma.currency.upsert({
      where: { code: 'USDT' },
      update: {},
      create: {
        code: 'USDT',
        name: 'Tether USD',
        symbol: '$',
        type: CurrencyType.CRYPTO,
        decimals: 6,
        isActive: true
      }
    }),
    prisma.currency.upsert({
      where: { code: 'BTC' },
      update: {},
      create: {
        code: 'BTC',
        name: 'Bitcoin',
        symbol: '₿',
        type: CurrencyType.CRYPTO,
        decimals: 8,
        isActive: true
      }
    }),
    prisma.currency.upsert({
      where: { code: 'ETH' },
      update: {},
      create: {
        code: 'ETH',
        name: 'Ethereum',
        symbol: 'Ξ',
        type: CurrencyType.CRYPTO,
        decimals: 8,
        isActive: true
      }
    }),
    prisma.currency.upsert({
      where: { code: 'USD' },
      update: {},
      create: {
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        type: CurrencyType.FIAT,
        decimals: 2,
        isActive: true
      }
    }),
    prisma.currency.upsert({
      where: { code: 'RUB' },
      update: {},
      create: {
        code: 'RUB',
        name: 'Russian Ruble',
        symbol: '₽',
        type: CurrencyType.FIAT,
        decimals: 2,
        isActive: true
      }
    }),
    prisma.currency.upsert({
      where: { code: 'TRY' },
      update: {},
      create: {
        code: 'TRY',
        name: 'Turkish Lira',
        symbol: '₺',
        type: CurrencyType.CASH,
        decimals: 2,
        isActive: true
      }
    })
  ])

  console.log('✅ Валюты созданы')

  // Получаем офисы
  const offices = await prisma.office.findMany()
  const adminUser = await prisma.user.findUnique({ where: { username: 'admin' } })

  if (!adminUser) {
    console.error('❌ Пользователь admin не найден')
    return
  }

  // Создаем счета для каждого офиса
  const accounts = []
  for (const office of offices) {
    for (const currency of currencies) {
      // Создаем основной счет для каждой валюты
      const account = await prisma.account.create({
        data: {
          officeId: office.id,
          currencyId: currency.id,
          type: currency.type === CurrencyType.CRYPTO ? AccountType.CRYPTO : AccountType.CASH,
          name: `${currency.code} ${currency.type === CurrencyType.CRYPTO ? 'кошелек' : 'касса'}`,
          description: `Основной счет ${currency.name} в офисе ${office.name}`,
          balance: Math.random() * 100000 + 10000, // Случайный баланс от 10к до 110к
          initialBalance: 50000,
          minBalance: currency.type === CurrencyType.CRYPTO ? 1000 : 5000,
          maxBalance: currency.type === CurrencyType.CRYPTO ? 500000 : 1000000,
          isActive: true
        }
      })
      accounts.push(account)
    }
  }

  console.log('✅ Счета созданы')

  // Создаем курсы валют на сегодня
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const exchangeRates = [
    { currencyId: currencies.find(c => c.code === 'USDT')!.id, purchaseRate: 96.5, defaultMargin: 1.5 },
    { currencyId: currencies.find(c => c.code === 'BTC')!.id, purchaseRate: 6500000, defaultMargin: 2.0 },
    { currencyId: currencies.find(c => c.code === 'ETH')!.id, purchaseRate: 330000, defaultMargin: 1.5 },
    { currencyId: currencies.find(c => c.code === 'USD')!.id, purchaseRate: 95.0, defaultMargin: 1.0 },
    { currencyId: currencies.find(c => c.code === 'TRY')!.id, purchaseRate: 2.8, defaultMargin: 2.5 }
  ]

  for (const rate of exchangeRates) {
    const sellRate = rate.purchaseRate * (1 + rate.defaultMargin / 100)
    
    await prisma.exchangeRate.upsert({
      where: {
        currencyId_rateDate: {
          currencyId: rate.currencyId,
          rateDate: today
        }
      },
      update: {
        purchaseRate: rate.purchaseRate,
        sellRate,
        defaultMargin: rate.defaultMargin,
        setBy: adminUser.id
      },
      create: {
        currencyId: rate.currencyId,
        purchaseRate: rate.purchaseRate,
        sellRate,
        defaultMargin: rate.defaultMargin,
        rateDate: today,
        setBy: adminUser.id
      }
    })
  }

  console.log('✅ Курсы валют установлены')

  // Создаем категории операций
  const categories = await Promise.all([
    prisma.operationCategory.upsert({
      where: { id: 'cat-commission' },
      update: {},
      create: {
        id: 'cat-commission',
        name: 'Комиссии с обменов',
        description: 'Доходы от комиссий за операции обмена',
        type: 'income',
        isActive: true
      }
    }),
    prisma.operationCategory.upsert({
      where: { id: 'cat-rent' },
      update: {},
      create: {
        id: 'cat-rent',
        name: 'Аренда офиса',
        description: 'Расходы на аренду офисных помещений',
        type: 'expense',
        isActive: true
      }
    }),
    prisma.operationCategory.upsert({
      where: { id: 'cat-salary' },
      update: {},
      create: {
        id: 'cat-salary',
        name: 'Зарплата сотрудников',
        description: 'Расходы на выплату заработной платы',
        type: 'expense',
        isActive: true
      }
    }),
    prisma.operationCategory.upsert({
      where: { id: 'cat-deposit-interest' },
      update: {},
      create: {
        id: 'cat-deposit-interest',
        name: 'Проценты по депозитам',
        description: 'Расходы на выплату процентов по депозитам',
        type: 'expense',
        isActive: true
      }
    })
  ])

  console.log('✅ Категории операций созданы')

  // Создаем несколько операций для демонстрации
  const usdtCurrency = currencies.find(c => c.code === 'USDT')!
  const usdtAccount = accounts.find(a => a.currencyId === usdtCurrency.id)!

  if (usdtAccount) {
    // Операция пополнения
    await prisma.operation.create({
      data: {
        officeId: offices[0].id,
        type: OperationType.DEPOSIT,
        toAccountId: usdtAccount.id,
        amount: 50000,
        currencyId: usdtCurrency.id,
        description: 'Пополнение кассы USDT',
        notes: 'Первоначальное пополнение для работы',
        performedBy: adminUser.id
      }
    })

    // Операция доходов от комиссий
    await prisma.operation.create({
      data: {
        officeId: offices[0].id,
        type: OperationType.EXCHANGE,
        toAccountId: usdtAccount.id,
        amount: 150,
        currencyId: usdtCurrency.id,
        categoryId: categories[0].id, // Комиссии
        description: 'Комиссия за обмен',
        notes: 'Комиссия 1.5% с операции обмена',
        performedBy: adminUser.id
      }
    })
  }

  console.log('✅ Демо-операции созданы')

  // Создаем несколько депозитов
  const clients = await prisma.client.findMany({ take: 2 })
  
  if (clients.length > 0) {
    // Депозит клиента
    await prisma.deposit.create({
      data: {
        type: DepositType.CLIENT,
        clientId: clients[0].id,
        officeId: offices[0].id,
        currencyId: usdtCurrency.id,
        amount: 10000,
        interestRate: 5.0,
        term: 30,
        startDate: new Date(),
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        description: 'Депозит клиента на 30 дней',
        isActive: true
      }
    })
  }

  // Депозит собственника
  await prisma.deposit.create({
    data: {
      type: DepositType.OWNER,
      officeId: offices[0].id,
      currencyId: currencies.find(c => c.code === 'BTC')!.id,
      amount: 0.5,
      interestRate: 0,
      startDate: new Date(),
      description: 'Инвестиции собственника в BTC',
      isActive: true
    }
  })

  console.log('✅ Депозиты созданы')

  // Обновляем дату последнего обращения у клиентов
  if (clients.length > 0) {
    for (const client of clients) {
      await prisma.client.update({
        where: { id: client.id },
        data: {
          lastContactDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Случайная дата в последние 30 дней
          customRateMargin: Math.random() > 0.5 ? Number((Math.random() * 2).toFixed(1)) : null // 50% клиентов получают индивидуальную маржу
        }
      })
    }
  }

  console.log('✅ Данные клиентов обновлены')
  console.log('🎉 Заполнение данных системы учета завершено!')
}

// Запускаем заполнение, если файл запущен напрямую
if (require.main === module) {
  seedAccountingData()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
