import cron from 'node-cron'
import { prisma } from './prisma'
import { RequestStatus, NotificationType } from '@prisma/client'
import { addMinutes, isAfter, differenceInMinutes } from 'date-fns'
import { NotificationService } from './notifications'

export class SLAMonitor {
  private static isRunning = false

  static start() {
    if (this.isRunning) {
      console.log('SLA Monitor уже запущен')
      return
    }

    this.isRunning = true
    console.log('🚀 SLA Monitor запущен')

    // Проверяем каждые 5 минут
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.checkSLA()
      } catch (error) {
        console.error('Ошибка в SLA Monitor:', error)
      }
    })

    // Проверяем просроченные заявки каждый час
    cron.schedule('0 * * * *', async () => {
      try {
        await this.checkOverdueRequests()
      } catch (error) {
        console.error('Ошибка в проверке просроченных заявок:', error)
      }
    })

    // Отправляем ежедневный отчет каждый день в 9:00
    cron.schedule('0 9 * * *', async () => {
      try {
        await this.sendDailyReport()
      } catch (error) {
        console.error('Ошибка в отправке ежедневного отчета:', error)
      }
    })

    // Проверяем курсы валют каждый день в 9:30
    cron.schedule('30 9 * * *', async () => {
      try {
        await NotificationService.checkExchangeRatesUpdate()
      } catch (error) {
        console.error('Ошибка в проверке курсов валют:', error)
      }
    })

    // Проверяем балансы счетов каждые 4 часа
    cron.schedule('0 */4 * * *', async () => {
      try {
        await NotificationService.checkAccountBalances()
      } catch (error) {
        console.error('Ошибка в проверке балансов счетов:', error)
      }
    })

    // Проверяем истекающие депозиты каждый день в 10:00
    cron.schedule('0 10 * * *', async () => {
      try {
        await NotificationService.checkExpiringDeposits()
      } catch (error) {
        console.error('Ошибка в проверке истекающих депозитов:', error)
      }
    })
  }

  static async checkSLA() {
    const now = new Date()
    const upcomingTime = addMinutes(now, 30) // Предупреждение за 30 минут

    // Находим заявки, у которых SLA истекает в ближайшие 30 минут
    const upcomingRequests = await prisma.request.findMany({
      where: {
        slaDeadline: {
          gt: now,
          lt: upcomingTime,
        },
        status: {
          notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED, RequestStatus.REJECTED],
        },
        isOverdue: false,
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        office: {
          select: {
            name: true,
          },
        },
      },
    })

    for (const request of upcomingRequests) {
      const minutesToSLA = differenceInMinutes(request.slaDeadline!, now)

      // Отправляем уведомление кассиру
      if (request.assignedUser) {
        const existingNotification = await prisma.notification.findFirst({
          where: {
            userId: request.assignedUser.id,
            type: NotificationType.SLA_OVERDUE,
            payload: {
              path: ['requestId'],
              equals: request.id,
            },
            createdAt: {
              gt: addMinutes(now, -10), // Не отправляем повторно в течение 10 минут
            },
          },
        })

        if (!existingNotification) {
          await prisma.notification.create({
            data: {
              userId: request.assignedUser.id,
              type: NotificationType.SLA_OVERDUE,
              title: 'Приближается дедлайн SLA',
              message: `Заявка ${request.requestId} (${request.client.firstName}) истекает через ${minutesToSLA} мин`,
              payload: {
                requestId: request.id,
                clientName: request.client.firstName,
                minutesLeft: minutesToSLA,
              },
            },
          })
        }
      }

      // Отмечаем как "приближается дедлайн"
      await prisma.request.update({
        where: { id: request.id },
        data: {
          isOverdue: false, // Пока не просрочено
        },
      })
    }

    console.log(`⏰ SLA check: найдено ${upcomingRequests.length} заявок с приближающимся дедлайном`)
  }

  static async checkOverdueRequests() {
    const now = new Date()

    // Находим просроченные заявки
    const overdueRequests = await prisma.request.findMany({
      where: {
        slaDeadline: {
          lt: now,
        },
        status: {
          notIn: [RequestStatus.COMPLETED, RequestStatus.CANCELED, RequestStatus.REJECTED],
        },
        isOverdue: false,
      },
      include: {
        client: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        assignedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        office: {
          select: {
            name: true,
          },
        },
      },
    })

    for (const request of overdueRequests) {
      // Отмечаем как просроченную
      await prisma.request.update({
        where: { id: request.id },
        data: {
          isOverdue: true,
        },
      })

      // Отправляем уведомление кассиру
      if (request.assignedUser) {
        await prisma.notification.create({
          data: {
            userId: request.assignedUser.id,
            type: NotificationType.SLA_OVERDUE,
            title: 'SLA просрочена!',
            message: `Заявка ${request.requestId} (${request.client.firstName}) просрочена`,
            payload: {
              requestId: request.id,
              clientName: request.client.firstName,
              isOverdue: true,
            },
          },
        })
      }

      // Отправляем уведомление администраторам
      const admins = await prisma.user.findMany({
        where: {
          role: 'ADMIN',
          isActive: true,
        },
        select: {
          id: true,
        },
      })

      for (const admin of admins) {
        await prisma.notification.create({
          data: {
            userId: admin.id,
            type: NotificationType.SYSTEM,
            title: 'Просроченная заявка',
            message: `Заявка ${request.requestId} в офисе ${request.office?.name || 'неизвестный офис'} просрочена`,
            payload: {
              requestId: request.id,
              officeName: request.office?.name || 'неизвестный офис',
              isOverdue: true,
            },
          },
        })
      }

      // Логируем просрочку
      await prisma.auditLog.create({
        data: {
          actorId: 'system',
          entityType: 'request',
          entityId: request.id,
          action: 'sla_overdue',
          oldValues: {
            slaDeadline: request.slaDeadline,
          },
        },
      })
    }

    if (overdueRequests.length > 0) {
      console.log(`⚠️ Найдено ${overdueRequests.length} просроченных заявок`)
    }
  }

  static async sendDailyReport() {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    // Статистика за вчера
    const yesterdayStats = await prisma.request.findMany({
      where: {
        createdAt: {
          gte: yesterday,
          lt: new Date(),
        },
      },
    })

    const completedCount = yesterdayStats.filter(r => r.status === RequestStatus.COMPLETED).length
    const totalVolume = await prisma.requestFinance.aggregate({
      where: {
        request: {
          createdAt: {
            gte: yesterday,
            lt: new Date(),
          },
          status: RequestStatus.COMPLETED,
        },
      },
      _sum: {
        expectedAmountFrom: true,
      },
    })

    // Отправляем отчет администраторам
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
      },
      select: {
        id: true,
      },
    })

    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          type: NotificationType.SYSTEM,
          title: 'Ежедневный отчет',
          message: `Вчера: ${yesterdayStats.length} заявок, ${completedCount} выполнено, объем: ${totalVolume._sum.expectedAmountFrom || 0} USDT`,
          payload: {
            reportType: 'daily',
            totalRequests: yesterdayStats.length,
            completedRequests: completedCount,
            totalVolume: totalVolume._sum.expectedAmountFrom || 0,
            date: yesterday.toISOString(),
          },
        },
      })
    }

    console.log(`📊 Отправлен ежедневный отчет администраторам`)
  }

  static async sendReminder(requestId: string) {
    try {
      const request = await prisma.request.findUnique({
        where: { id: requestId },
        include: {
          client: {
            select: {
              telegramUserId: true,
              firstName: true,
            },
          },
          office: {
            select: {
              name: true,
            },
          },
        },
      })

      if (!request) {
        console.error(`Заявка ${requestId} не найдена`)
        return
      }

      // Здесь должна быть интеграция с Telegram Bot API
      // Пока просто логируем
      console.log(`📤 Отправлено напоминание клиенту ${request.client.firstName} по заявке ${request.requestId}`)

      // В будущем:
      // await telegramBot.sendMessage(request.client.telegramUserId, reminderMessage)

    } catch (error) {
      console.error('Ошибка отправки напоминания:', error)
    }
  }
}

// Запускаем мониторинг SLA при импорте модуля
if (typeof window === 'undefined') {
  // Только на сервере
  SLAMonitor.start()
}
