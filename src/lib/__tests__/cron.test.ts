import { describe, it, expect, vi, beforeEach } from 'vitest'
import cron from 'node-cron'
import { SLAMonitor } from '../cron'
import { prisma } from '@/lib/prisma'
import { RequestStatus, NotificationType } from '@prisma/client'

// Mock зависимостей
vi.mock('node-cron')
vi.mock('@/lib/prisma')

describe('SLAMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    SLAMonitor['isRunning'] = false // Reset static property
  })

  describe('start', () => {
    it('should start SLA monitor if not already running', () => {
      const mockSchedule = vi.fn()
      ;(cron.schedule as any).mockImplementation(mockSchedule)

      SLAMonitor.start()

      expect(SLAMonitor['isRunning']).toBe(true)
      expect(cron.schedule).toHaveBeenCalledTimes(3) // checkSLA, checkOverdueRequests, sendDailyReport
      expect(cron.schedule).toHaveBeenCalledWith('*/5 * * * *', expect.any(Function))
      expect(cron.schedule).toHaveBeenCalledWith('0 * * * *', expect.any(Function))
      expect(cron.schedule).toHaveBeenCalledWith('0 9 * * *', expect.any(Function))
    })

    it('should not start if already running', () => {
      SLAMonitor['isRunning'] = true
      const mockSchedule = vi.fn()
      ;(cron.schedule as any).mockImplementation(mockSchedule)

      SLAMonitor.start()

      expect(cron.schedule).not.toHaveBeenCalled()
    })
  })

  describe('checkSLA', () => {
    it('should create notifications for upcoming SLA deadlines', async () => {
      const mockRequests = [
        {
          id: 'req1',
          slaDeadline: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes from now
          status: RequestStatus.IN_PROGRESS,
          isOverdue: false,
          client: { firstName: 'Иван', lastName: 'Иванов' },
          assignedUser: { id: 'user1', firstName: 'Петр', lastName: 'Петров' },
          office: { name: 'Главный офис' },
        },
      ]

      const mockNotificationFind = vi.fn().mockResolvedValue(null)
      const mockNotificationCreate = vi.fn().mockResolvedValue({})
      const mockRequestUpdate = vi.fn().mockResolvedValue({})

      ;(prisma.request.findMany as any).mockResolvedValue(mockRequests)
      ;(prisma.notification.findFirst as any).mockImplementation(mockNotificationFind)
      ;(prisma.notification.create as any).mockImplementation(mockNotificationCreate)
      ;(prisma.request.update as any).mockImplementation(mockRequestUpdate)

      await SLAMonitor['checkSLA']()

      expect(prisma.request.findMany).toHaveBeenCalled()
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          type: NotificationType.SLA_OVERDUE,
          title: 'Приближается дедлайн SLA',
          message: 'Заявка req1 (Иван) истекает через 20 мин',
          payload: {
            requestId: 'req1',
            clientName: 'Иван',
            minutesLeft: 20,
          },
        },
      })
    })

    it('should not create duplicate notifications', async () => {
      const mockRequests = [
        {
          id: 'req1',
          slaDeadline: new Date(Date.now() + 20 * 60 * 1000),
          status: RequestStatus.IN_PROGRESS,
          isOverdue: false,
          client: { firstName: 'Иван', lastName: 'Иванов' },
          assignedUser: { id: 'user1', firstName: 'Петр', lastName: 'Петров' },
          office: { name: 'Главный офис' },
        },
      ]

      const mockNotificationFind = vi.fn().mockResolvedValue({ id: 'existing' })
      const mockNotificationCreate = vi.fn().mockResolvedValue({})

      ;(prisma.request.findMany as any).mockResolvedValue(mockRequests)
      ;(prisma.notification.findFirst as any).mockImplementation(mockNotificationFind)
      ;(prisma.notification.create as any).mockImplementation(mockNotificationCreate)

      await SLAMonitor['checkSLA']()

      expect(prisma.notification.create).not.toHaveBeenCalled()
    })

    it('should handle empty results', async () => {
      ;(prisma.request.findMany as any).mockResolvedValue([])
      ;(prisma.notification.findFirst as any).mockResolvedValue(null)
      ;(prisma.notification.create as any).mockResolvedValue({})

      await SLAMonitor['checkSLA']()

      expect(prisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('checkOverdueRequests', () => {
    it('should mark overdue requests and create notifications', async () => {
      const mockRequests = [
        {
          id: 'req1',
          slaDeadline: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          status: RequestStatus.IN_PROGRESS,
          isOverdue: false,
          client: { firstName: 'Иван', lastName: 'Иванов' },
          assignedUser: { id: 'user1', firstName: 'Петр', lastName: 'Петров' },
          office: { name: 'Главный офис' },
        },
      ]

      const mockAdmins = [
        { id: 'admin1' },
        { id: 'admin2' },
      ]

      ;(prisma.request.findMany as any).mockResolvedValue(mockRequests)
      ;(prisma.user.findMany as any).mockResolvedValue(mockAdmins)
      ;(prisma.request.update as any).mockResolvedValue({})
      ;(prisma.notification.create as any).mockResolvedValue({})
      ;(prisma.auditLog.create as any).mockResolvedValue({})

      await SLAMonitor['checkOverdueRequests']()

      expect(prisma.request.update).toHaveBeenCalledWith({
        where: { id: 'req1' },
        data: { isOverdue: true },
      })

      // Should create notification for assigned user
      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'user1',
          type: NotificationType.SLA_OVERDUE,
          title: 'SLA просрочена!',
          message: 'Заявка req1 (Иван) просрочена',
          payload: {
            requestId: 'req1',
            clientName: 'Иван',
            isOverdue: true,
          },
        },
      })

      // Should create notifications for all admins
      expect(prisma.notification.create).toHaveBeenCalledTimes(3) // 1 for user + 2 for admins
    })

    it('should not process already overdue requests', async () => {
      const mockRequests = [
        {
          id: 'req1',
          slaDeadline: new Date(Date.now() - 10 * 60 * 1000),
          status: RequestStatus.IN_PROGRESS,
          isOverdue: true, // Already marked as overdue
          client: { firstName: 'Иван', lastName: 'Иванов' },
          assignedUser: { id: 'user1', firstName: 'Петр', lastName: 'Петров' },
          office: { name: 'Главный офис' },
        },
      ]

      ;(prisma.request.findMany as any).mockResolvedValue(mockRequests)
      ;(prisma.request.update as any).mockResolvedValue({})
      ;(prisma.notification.create as any).mockResolvedValue({})

      await SLAMonitor['checkOverdueRequests']()

      expect(prisma.request.update).not.toHaveBeenCalled()
      expect(prisma.notification.create).not.toHaveBeenCalled()
    })
  })

  describe('sendDailyReport', () => {
    it('should send daily report to all admins', async () => {
      const mockYesterdayRequests = [
        { id: 'req1', status: RequestStatus.COMPLETED },
        { id: 'req2', status: RequestStatus.COMPLETED },
        { id: 'req3', status: RequestStatus.IN_PROGRESS },
      ]

      const mockFinanceData = {
        _sum: {
          expectedAmountFrom: 1500.00,
        },
      }

      const mockAdmins = [
        { id: 'admin1' },
        { id: 'admin2' },
      ]

      ;(prisma.request.findMany as any).mockResolvedValue(mockYesterdayRequests)
      ;(prisma.requestFinance.aggregate as any).mockResolvedValue(mockFinanceData)
      ;(prisma.user.findMany as any).mockResolvedValue(mockAdmins)
      ;(prisma.notification.create as any).mockResolvedValue({})

      await SLAMonitor['sendDailyReport']()

      expect(prisma.notification.create).toHaveBeenCalledTimes(2) // For each admin

      expect(prisma.notification.create).toHaveBeenCalledWith({
        data: {
          userId: 'admin1',
          type: NotificationType.SYSTEM,
          title: 'Ежедневный отчет',
          message: 'Вчера: 3 заявок, 2 выполнено, объем: 1500 USDT',
          payload: {
            reportType: 'daily',
            totalRequests: 3,
            completedRequests: 2,
            totalVolume: 1500,
            date: expect.any(String),
          },
        },
      })
    })
  })
})
