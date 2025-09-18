import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../login/route'

// Mock зависимостей
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/auth', () => ({
  AuthService: {
    verifyPassword: vi.fn(),
    generateToken: vi.fn(),
  },
}))

describe('/api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST', () => {
    it('should login user successfully with valid credentials', async () => {
      const mockUser = {
        id: '123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'CASHIER',
        password: 'hashedPassword',
        email: 'test@example.com',
        isActive: true,
        officeIds: ['office1'],
      }

      const mockToken = 'jwtToken123'

      // Mock Prisma
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      // Mock AuthService
      const { AuthService } = await import('@/lib/auth')
      vi.mocked(AuthService.verifyPassword).mockResolvedValue(true)
      vi.mocked(AuthService.generateToken).mockReturnValue(mockToken)

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123',
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(vi.mocked(prisma.user.findUnique)).toHaveBeenCalledWith({
        where: { username: 'testuser' },
        select: expect.any(Object),
      })

      expect(vi.mocked(AuthService.verifyPassword)).toHaveBeenCalledWith('password123', 'hashedPassword')
      expect(vi.mocked(AuthService.generateToken)).toHaveBeenCalledWith({
        userId: '123',
        username: 'testuser',
        role: 'CASHIER',
        officeIds: ['office1'],
      })

      expect(response.status).toBe(200)
      expect(result.success).toBe(true)
      expect(result.user).toEqual({
        id: '123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        role: 'CASHIER',
        officeIds: ['office1'],
      })
    })

    it('should return error for invalid credentials', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'nonexistent',
          password: 'password123',
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Неверные учетные данные')
    })

    it('should return error for inactive user', async () => {
      const { prisma } = await import('@/lib/prisma')
      const mockUser = {
        id: '123',
        username: 'testuser',
        isActive: false,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123',
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Неверные учетные данные')
    })

    it('should return error for wrong password', async () => {
      const { prisma } = await import('@/lib/prisma')
      const { AuthService } = await import('@/lib/auth')
      const mockUser = {
        id: '123',
        username: 'testuser',
        password: 'hashedPassword',
        isActive: true,
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)
      vi.mocked(AuthService.verifyPassword).mockResolvedValue(false)

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          password: 'wrongpassword',
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(401)
      expect(result.error).toBe('Неверные учетные данные')
    })

    it('should return error for missing required fields', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          // missing password
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Необходимо указать имя пользователя и пароль')
    })

    it('should return error for invalid JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: 'invalid json',
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(400)
      expect(result.error).toBe('Неверный формат JSON')
    })

    it('should handle database errors', async () => {
      const { prisma } = await import('@/lib/prisma')
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('Database error'))

      const request = new NextRequest('http://localhost:3000/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          username: 'testuser',
          password: 'password123',
        }),
      })

      const response = await POST(request)
      const result = await response.json()

      expect(response.status).toBe(500)
      expect(result.error).toBe('Внутренняя ошибка сервера')
    })
  })
})
