import cron from 'node-cron'
import { prisma } from './prisma'
import { RequestStatus, NotificationType } from '@prisma/client'
import { addMinutes, isAfter, differenceInMinutes } from 'date-fns'
import { NotificationService } from './notifications'
import { shouldEscalate, getSLACriticality, formatTimeToDeadline } from './sla-config'

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
        finance: {
          select: {
            fromCurrency: true,
            expectedAmountFrom: true,
          },
        },
      },
    })

    for (const request of upcomingRequests) {
      const minutesToSLA = differenceInMinutes(request.slaDeadline!, now)
      const timeElapsed = differenceInMinutes(now, request.createdAt)
      
      // Проверяем эскалацию
      const escalation = shouldEscalate(request.direction, timeElapsed, 0)
      
      // Определяем критичность
      const criticality = getSLACriticality(false, minutesToSLA)

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
              title: `${criticality === 'critical' ? '🚨 КРИТИЧНО:' : '⚠️'} Приближается дедлайн SLA`,
              message: `Заявка ${request.requestId} (${request.client.firstName}, ${request.finance?.expectedAmountFrom} ${request.finance?.fromCurrency}) истекает через ${formatTimeToDeadline(minutesToSLA)}`,
              payload: {
                requestId: request.id,
                clientName: request.client.firstName,
                minutesLeft: minutesToSLA,
                criticality,
                amount: request.finance?.expectedAmountFrom,
                currency: request.finance?.fromCurrency,
              },
            },
          })
        }
      }

      // Отправляем эскалационные уведомления
      if (escalation.shouldEscalate) {
        await this.sendEscalationNotifications(request, escalation.level, escalation.notifyRoles, timeElapsed)
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

  static async sendEscalationNotifications(request: any, level: number, notifyRoles: string[], timeElapsed: number) {
    try {
      // Логируем эскалацию
      await prisma.auditLog.create({
        data: {
          actorId: 'system',
          entityType: 'request',
          entityId: request.id,
          action: 'sla_escalation',
          newValues: {
            escalationLevel: level,
            timeElapsed,
            notifyRoles,
          },
        },
      })

      // Отправляем уведомления по ролям
      for (const role of notifyRoles) {
        const users = await prisma.user.findMany({
          where: { role: role as any },
          select: { id: true, firstName: true, lastName: true },
        })

        for (const user of users) {
          await prisma.notification.create({
            data: {
              userId: user.id,
              type: NotificationType.SYSTEM,
              title: `🚨 Эскалация SLA уровень ${level}`,
              message: `Заявка ${request.requestId} требует внимания ${role}. Прошло ${formatTimeToDeadline(timeElapsed)} с момента создания`,
              payload: {
                requestId: request.id,
                escalationLevel: level,
                timeElapsed,
                role,
                urgent: true,
              },
            },
          })
        }
      }

      console.log(`🚨 SLA escalation level ${level} sent for request ${request.requestId}`)
    } catch (error) {
      console.error('Error sending escalation notifications:', error)
    }
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
