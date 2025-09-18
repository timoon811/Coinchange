import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../route'
import { prisma } from '@/lib/prisma'
import { RequestStatus, OperationDirection } from '@prisma/client'

// Mock зависимостей
vi.mock('@/lib/prisma')

describe('/api/requests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET', () => {
    it('should return requests list for authenticated user', async () => {
      const mockRequests = [
        {
          id: 'req1',
          requestId: 'REQ-001',
          status: RequestStatus.NEW,
          direction: OperationDirection.CRYPTO_TO_CASH,
          createdAt: new Date(),
          updatedAt: new Date(),
          client: {
            id: 'client1',
            firstName: 'Иван',
            lastName: 'Иванов',
            username: 'ivan123',
          },
          assignedUser: {
            id: 'user1',
            firstName: 'Петр',
            lastName: 'Петров',
          },
          finance: {
            expectedAmountFrom: 1000,
            fromCurrency: 'USDT',
          },
        },
      ]

      const mockTotal = 1

      ;(prisma.request.findMany as any).mockResolvedValue(mockRequests)
      ;(prisma.request.count as any).mockResolvedValue(mockTotal)

      const request = new NextRequest('http://localhost:3000/api/requests?page=1&limit=10', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
          'x-user-offices': JSON.stringify(['office1']),
        },
      })

      const response = await GET(request)
      const result = await response.json()

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
      expect(result.data[0]).toEqual({
        id: 'req1',
        requestId: 'REQ-001',
        status: RequestStatus.NEW,
        direction: OperationDirection.CRYPTO_TO_CASH,
        client: {
          id: 'client1',
          firstName: 'Иван',
          lastName: 'Иванов',
          username: 'ivan123',
        },
        finance: {
          expectedAmountFrom: 1000,
          fromCurrency: 'USDT',
        },
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      })
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        pages: 1,
      })
    })

    it('should filter requests by status', async () => {
      const mockRequests = [
        {
          id: 'req1',
          status: RequestStatus.COMPLETED,
          createdAt: new Date(),
          client: { firstName: 'Иван' },
        },
      ]

      ;(prisma.request.findMany as any).mockResolvedValue(mockRequests)
      ;(prisma.request.count as any).mockResolvedValue(1)

      const request = new NextRequest('http://localhost:3000/api/requests?status=COMPLETED', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
        },
      })

      await GET(request)

      expect(prisma.request.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          status: RequestStatus.COMPLETED,
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      })
    })

    it('should filter requests by direction', async () => {
      ;(prisma.request.findMany as any).mockResolvedValue([])
      ;(prisma.request.count as any).mockResolvedValue(0)

      const request = new NextRequest('http://localhost:3000/api/requests?direction=CRYPTO_TO_CASH', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
        },
      })

      await GET(request)

      expect(prisma.request.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          direction: OperationDirection.CRYPTO_TO_CASH,
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      })
    })

    it('should search requests by client name', async () => {
      ;(prisma.request.findMany as any).mockResolvedValue([])
      ;(prisma.request.count as any).mockResolvedValue(0)

      const request = new NextRequest('http://localhost:3000/api/requests?search=Иван', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
        },
      })

      await GET(request)

      expect(prisma.request.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { requestId: { contains: 'Иван', mode: 'insensitive' } },
            { client: { firstName: { contains: 'Иван', mode: 'insensitive' } } },
            { client: { lastName: { contains: 'Иван', mode: 'insensitive' } } },
            { client: { username: { contains: 'Иван', mode: 'insensitive' } } },
          ],
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      })
    })

    it('should restrict access for cashiers to their offices', async () => {
      ;(prisma.request.findMany as any).mockResolvedValue([])
      ;(prisma.request.count as any).mockResolvedValue(0)

      const request = new NextRequest('http://localhost:3000/api/requests', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
          'x-user-offices': JSON.stringify(['office1', 'office2']),
        },
      })

      await GET(request)

      expect(prisma.request.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          officeId: {
            in: ['office1', 'office2'],
          },
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      })
    })

    it('should allow admins to see all requests', async () => {
      ;(prisma.request.findMany as any).mockResolvedValue([])
      ;(prisma.request.count as any).mockResolvedValue(0)

      const request = new NextRequest('http://localhost:3000/api/requests', {
        headers: {
          'x-user-id': 'admin123',
          'x-user-role': 'ADMIN',
        },
      })

      await GET(request)

      expect(prisma.request.findMany).toHaveBeenCalledWith({
        where: expect.not.objectContaining({
          officeId: expect.any(Object),
        }),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: expect.any(Number),
        take: expect.any(Number),
      })
    })

    it('should return error for unauthenticated user', async () => {
      const request = new NextRequest('http://localhost:3000/api/requests')

      const response = await GET(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Не авторизован')
    })

    it('should handle database errors', async () => {
      ;(prisma.request.findMany as any).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/requests', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
        },
      })

      const response = await GET(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Внутренняя ошибка сервера')
    })

    it('should handle pagination correctly', async () => {
      ;(prisma.request.findMany as any).mockResolvedValue([])
      ;(prisma.request.count as any).mockResolvedValue(25)

      const request = new NextRequest('http://localhost:3000/api/requests?page=2&limit=10', {
        headers: {
          'x-user-id': 'user123',
          'x-user-role': 'CASHIER',
        },
      })

      await GET(request)

      expect(prisma.request.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        include: expect.any(Object),
        orderBy: expect.any(Object),
        skip: 10, // (page-1) * limit = 10
        take: 10,
      })
    })
  })
})
