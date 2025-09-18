import { test as base, expect } from '@playwright/test'
import { prisma } from '@/lib/prisma'
import { AuthService } from '@/lib/auth'
import { UserRole } from '@prisma/client'

// Расширяем базовый тестовый контекст
export const test = base.extend({
  // Авторизация пользователя для тестов
  authenticatedUser: async ({ page }, use) => {
    // Создаем тестового пользователя
    const testUser = await prisma.user.create({
      data: {
        username: `test_user_${Date.now()}`,
        email: `test${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'User',
        password: await AuthService.hashPassword('testpassword123'),
        role: UserRole.CASHIER,
        officeIds: [],
      },
    })

    // Получаем токен
    const token = AuthService.generateToken({
      userId: testUser.id,
      username: testUser.username,
      role: testUser.role,
      officeIds: testUser.officeIds,
    })

    // Устанавливаем токен в localStorage и cookies
    await page.addInitScript((token) => {
      localStorage.setItem('auth-token', token)
      document.cookie = `auth-token=${token}; path=/`
    }, token)

    await use(testUser)

    // Очистка после теста
    await prisma.user.delete({
      where: { id: testUser.id },
    })
  },

  // Создание тестового офиса
  testOffice: async ({}, use) => {
    const office = await prisma.office.create({
      data: {
        name: `Test Office ${Date.now()}`,
        city: 'Test City',
        address: 'Test Address 123',
        phone: '+7 (999) 123-45-67',
        email: 'test@office.com',
        activeCurrencies: ['USDT', 'BTC'],
        activeNetworks: ['ETH', 'BSC'],
        isActive: true,
      },
    })

    await use(office)

    // Очистка после теста
    await prisma.office.delete({
      where: { id: office.id },
    })
  },

  // Создание тестовой заявки
  testRequest: async ({ authenticatedUser, testOffice }, use) => {
    // Создаем клиента
    const client = await prisma.client.create({
      data: {
        telegramUserId: `test_${Date.now()}`,
        username: 'test_client',
        firstName: 'Test',
        lastName: 'Client',
      },
    })

    // Создаем заявку
    const request = await prisma.request.create({
      data: {
        requestId: `test-${Date.now()}`,
        clientId: client.id,
        officeId: testOffice.id,
        direction: 'CRYPTO_TO_CASH',
        status: 'NEW',
        source: 'telegram',
        locale: 'ru',
      },
    })

    // Создаем финансовую информацию
    const finance = await prisma.requestFinance.create({
      data: {
        requestId: request.id,
        fromCurrency: 'USDT',
        fromNetwork: 'ETH',
        toCurrency: 'RUB',
        expectedAmountFrom: 1000,
        expectedAmountTo: 95000,
        rateValue: 95,
        commissionPercent: 2,
      },
    })

    await use({
      request,
      client,
      finance,
      office: testOffice,
    })

    // Очистка после теста
    await prisma.requestFinance.delete({
      where: { id: finance.id },
    }).catch(() => {})

    await prisma.request.delete({
      where: { id: request.id },
    }).catch(() => {})

    await prisma.client.delete({
      where: { id: client.id },
    }).catch(() => {})
  },
})

// Экспортируем expect для удобства
export { expect }
