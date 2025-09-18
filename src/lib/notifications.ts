import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'

export class NotificationService {
  /**
   * Создает уведомление для пользователя
   */
  static async createNotification({
    userId,
    type,
    title,
    message,
    payload = {}
  }: {
    userId: string
    type: NotificationType
    title: string
    message: string
    payload?: Record<string, unknown>
  }) {
    try {
      return await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          payload
        }
      })
    } catch (error) {
      console.error('Error creating notification:', error)
      throw error
    }
  }

  /**
   * Создает уведомления для нескольких пользователей
   */
  static async createBulkNotifications({
    userIds,
    type,
    title,
    message,
    payload = {}
  }: {
    userIds: string[]
    type: NotificationType
    title: string
    message: string
    payload?: Record<string, unknown>
  }) {
    try {
      const notifications = userIds.map(userId => ({
        userId,
        type,
        title,
        message,
        payload
      }))

      return await prisma.notification.createMany({
        data: notifications
      })
    } catch (error) {
      console.error('Error creating bulk notifications:', error)
      throw error
    }
  }

  /**
   * Проверяет и уведомляет о необходимости обновления курсов валют
   */
  static async checkExchangeRatesUpdate() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Получаем все активные валюты
      const activeCurrencies = await prisma.currency.findMany({
        where: { isActive: true }
      })

      // Получаем курсы на сегодня
      const todayRates = await prisma.exchangeRate.findMany({
        where: {
          rateDate: today,
          isActive: true
        }
      })

      const ratesMap = new Set(todayRates.map(rate => rate.currencyId))
      const missingCurrencies = activeCurrencies.filter(currency => !ratesMap.has(currency.id))

      if (missingCurrencies.length > 0) {
        // Получаем всех администраторов
        const admins = await prisma.user.findMany({
          where: {
            role: 'ADMIN',
            isActive: true
          }
        })

        const adminIds = admins.map(admin => admin.id)
        const currencyCodes = missingCurrencies.map(c => c.code).join(', ')

        await this.createBulkNotifications({
          userIds: adminIds,
          type: NotificationType.RATE_UPDATE_NEEDED,
          title: 'Требуется обновление курсов валют',
          message: `Не установлены курсы для валют: ${currencyCodes}`,
          payload: {
            date: today.toISOString(),
            missingCurrencies: missingCurrencies.map(c => ({
              id: c.id,
              code: c.code,
              name: c.name
            }))
          }
        })

        console.log(`Created rate update notifications for ${missingCurrencies.length} currencies`)
        return { notified: true, missingCount: missingCurrencies.length }
      }

      return { notified: false, missingCount: 0 }
    } catch (error) {
      console.error('Error checking exchange rates update:', error)
      throw error
    }
  }

  /**
   * Проверяет балансы счетов и уведомляет о нарушениях лимитов
   */
  static async checkAccountBalances() {
    try {
      const accounts = await prisma.account.findMany({
        where: {
          isActive: true,
          OR: [
            { minBalance: { not: null } },
            { maxBalance: { not: null } }
          ]
        },
        include: {
          currency: true,
          office: {
            select: {
              id: true,
              name: true
            }
          }
        }
      })

      const lowBalanceAccounts = accounts.filter(account => 
        account.minBalance && Number(account.balance) < Number(account.minBalance)
      )

      const highBalanceAccounts = accounts.filter(account => 
        account.maxBalance && Number(account.balance) > Number(account.maxBalance)
      )

      let notificationCount = 0

      // Уведомления о низком балансе
      for (const account of lowBalanceAccounts) {
        // Получаем пользователей, имеющих доступ к этому офису
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'ADMIN' },
              { 
                role: 'CASHIER',
                officeIds: { has: account.officeId }
              }
            ],
            isActive: true
          }
        })

        const userIds = users.map(user => user.id)

        await this.createBulkNotifications({
          userIds,
          type: NotificationType.LOW_BALANCE,
          title: 'Низкий баланс счета',
          message: `Баланс счета "${account.name}" (${account.currency.code}) в офисе "${account.office.name}" ниже минимального`,
          payload: {
            accountId: account.id,
            accountName: account.name,
            balance: Number(account.balance),
            minBalance: Number(account.minBalance),
            currency: account.currency.code,
            office: account.office.name
          }
        })

        notificationCount++
      }

      // Уведомления о превышении максимального баланса
      for (const account of highBalanceAccounts) {
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'ADMIN' },
              { 
                role: 'CASHIER',
                officeIds: { has: account.officeId }
              }
            ],
            isActive: true
          }
        })

        const userIds = users.map(user => user.id)

        await this.createBulkNotifications({
          userIds,
          type: NotificationType.HIGH_BALANCE,
          title: 'Превышен максимальный баланс',
          message: `Баланс счета "${account.name}" (${account.currency.code}) в офисе "${account.office.name}" превышает максимальный`,
          payload: {
            accountId: account.id,
            accountName: account.name,
            balance: Number(account.balance),
            maxBalance: Number(account.maxBalance),
            currency: account.currency.code,
            office: account.office.name
          }
        })

        notificationCount++
      }

      return { 
        notified: notificationCount > 0, 
        lowBalanceCount: lowBalanceAccounts.length,
        highBalanceCount: highBalanceAccounts.length
      }
    } catch (error) {
      console.error('Error checking account balances:', error)
      throw error
    }
  }

  /**
   * Проверяет истекающие депозиты
   */
  static async checkExpiringDeposits() {
    try {
      const thirtyDaysFromNow = new Date()
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

      const expiringDeposits = await prisma.deposit.findMany({
        where: {
          isActive: true,
          endDate: {
            lte: thirtyDaysFromNow,
            gte: new Date()
          }
        },
        include: {
          currency: true,
          office: {
            select: {
              id: true,
              name: true
            }
          },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true
            }
          }
        }
      })

      let notificationCount = 0

      for (const deposit of expiringDeposits) {
        const daysUntilExpiry = Math.ceil(
          (new Date(deposit.endDate!).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
        )

        // Получаем пользователей, имеющих доступ к этому офису
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { role: 'ADMIN' },
              { 
                role: 'CASHIER',
                officeIds: { has: deposit.officeId }
              }
            ],
            isActive: true
          }
        })

        const userIds = users.map(user => user.id)
        const clientName = deposit.client ? 
          [deposit.client.firstName, deposit.client.lastName].filter(Boolean).join(' ') || deposit.client.username :
          'Собственник'

        await this.createBulkNotifications({
          userIds,
          type: NotificationType.DEPOSIT_EXPIRING,
          title: 'Истекает депозит',
          message: `Депозит ${clientName} (${deposit.currency.code}) истекает через ${daysUntilExpiry} дней`,
          payload: {
            depositId: deposit.id,
            clientName,
            amount: Number(deposit.amount),
            currency: deposit.currency.code,
            office: deposit.office.name,
            endDate: deposit.endDate,
            daysUntilExpiry
          }
        })

        notificationCount++
      }

      return { 
        notified: notificationCount > 0, 
        expiringCount: expiringDeposits.length
      }
    } catch (error) {
      console.error('Error checking expiring deposits:', error)
      throw error
    }
  }

  /**
   * Выполняет все проверки и отправляет уведомления
   */
  static async runDailyChecks() {
    console.log('Running daily notification checks...')
    
    try {
      const results = await Promise.allSettled([
        this.checkExchangeRatesUpdate(),
        this.checkAccountBalances(),
        this.checkExpiringDeposits()
      ])

      const summary = {
        exchangeRates: results[0].status === 'fulfilled' ? results[0].value : { error: results[0].reason },
        accountBalances: results[1].status === 'fulfilled' ? results[1].value : { error: results[1].reason },
        expiringDeposits: results[2].status === 'fulfilled' ? results[2].value : { error: results[2].reason }
      }

      console.log('Daily checks completed:', summary)
      return summary
    } catch (error) {
      console.error('Error running daily checks:', error)
      throw error
    }
  }
}
