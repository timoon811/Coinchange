import cron from 'node-cron'
import { NotificationService } from './notifications'

/**
 * Настройка cron jobs для уведомлений
 */
export function setupNotificationCronJobs() {
  console.log('Setting up notification cron jobs...')

  // Ежедневная проверка курсов валют в 9:00
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily exchange rate check...')
    try {
      await NotificationService.checkExchangeRatesUpdate()
    } catch (error) {
      console.error('Error in exchange rate check cron:', error)
    }
  }, {
    timezone: 'Europe/Moscow'
  })

  // Проверка балансов счетов каждые 4 часа
  cron.schedule('0 */4 * * *', async () => {
    console.log('Running account balance check...')
    try {
      await NotificationService.checkAccountBalances()
    } catch (error) {
      console.error('Error in account balance check cron:', error)
    }
  }, {
    timezone: 'Europe/Moscow'
  })

  // Проверка истекающих депозитов ежедневно в 10:00
  cron.schedule('0 10 * * *', async () => {
    console.log('Running expiring deposits check...')
    try {
      await NotificationService.checkExpiringDeposits()
    } catch (error) {
      console.error('Error in expiring deposits check cron:', error)
    }
  }, {
    timezone: 'Europe/Moscow'
  })

  console.log('Notification cron jobs set up successfully')
}

/**
 * Инициализация cron jobs только в production
 */
export function initNotificationCrons() {
  if (process.env.NODE_ENV === 'production') {
    setupNotificationCronJobs()
  } else {
    console.log('Notification cron jobs disabled in development mode')
    console.log('To test notifications, use: GET /api/notifications/check')
  }
}
