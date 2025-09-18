import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { AuthService } from '../auth'

// Mock зависимостей
vi.mock('bcryptjs')
vi.mock('jsonwebtoken')

describe('AuthService', () => {
  const mockBcrypt = vi.mocked(bcrypt)
  const mockJwt = vi.mocked(jwt)

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'a'.repeat(32)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      const password = 'testPassword123'
      const hashedPassword = 'hashedPassword'

      mockBcrypt.hash.mockResolvedValue(hashedPassword)

      const result = await AuthService.hashPassword(password)

      expect(mockBcrypt.hash).toHaveBeenCalledWith(password, 12)
      expect(result).toBe(hashedPassword)
    })

    it('should throw error when bcrypt.hash fails', async () => {
      const password = 'testPassword123'
      const error = new Error('Hashing failed')

      mockBcrypt.hash.mockRejectedValue(error)

      await expect(AuthService.hashPassword(password)).rejects.toThrow('Hashing failed')
    })
  })

  describe('verifyPassword', () => {
    it('should return true for matching passwords', async () => {
      const password = 'testPassword123'
      const hashedPassword = 'hashedPassword'

      mockBcrypt.compare.mockResolvedValue(true as any)

      const result = await AuthService.verifyPassword(password, hashedPassword)

      expect(mockBcrypt.compare).toHaveBeenCalledWith(password, hashedPassword)
      expect(result).toBe(true)
    })

    it('should return false for non-matching passwords', async () => {
      const password = 'testPassword123'
      const hashedPassword = 'hashedPassword'

      mockBcrypt.compare.mockResolvedValue(false as any)

      const result = await AuthService.verifyPassword(password, hashedPassword)

      expect(result).toBe(false)
    })
  })

  describe('generateToken', () => {
    it('should generate JWT token successfully', () => {
      const payload = { userId: '123', username: 'test', role: 'ADMIN' as const, officeIds: [] }
      const token = 'generatedToken'

      mockJwt.sign.mockReturnValue(token as any)

      const result = AuthService.generateToken(payload)

      expect(mockJwt.sign).toHaveBeenCalledWith(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
      expect(result).toBe(token)
    })

    it('should throw error when JWT_SECRET is not set', () => {
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET

      const payload = { userId: '123', username: 'test', role: 'ADMIN' as const, officeIds: [] }

      expect(() => AuthService.generateToken(payload)).toThrow()

      process.env.JWT_SECRET = originalSecret
    })
  })

  describe('verifyToken', () => {
    it('should verify JWT token successfully', () => {
      const token = 'validToken'
      const decodedPayload = { userId: '123', username: 'test', role: 'ADMIN' as const, officeIds: [] }

      mockJwt.verify.mockReturnValue(decodedPayload as any)

      const result = AuthService.verifyToken(token)

      expect(mockJwt.verify).toHaveBeenCalledWith(token, process.env.JWT_SECRET)
      expect(result).toEqual(decodedPayload)
    })

    it('should return null for invalid token', () => {
      const token = 'invalidToken'

      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const result = AuthService.verifyToken(token)

      expect(result).toBeNull()
    })

    it('should throw error when JWT_SECRET is not set', () => {
      const originalSecret = process.env.JWT_SECRET
      delete process.env.JWT_SECRET

      const token = 'validToken'

      expect(() => AuthService.verifyToken(token)).toThrow()

      process.env.JWT_SECRET = originalSecret
    })
  })

  describe('hasPermission', () => {
    it('should return true for admin accessing admin resource', () => {
      const result = AuthService.hasPermission('ADMIN', 'ADMIN')
      expect(result).toBe(true)
    })

    it('should return true for admin accessing cashier resource', () => {
      const result = AuthService.hasPermission('ADMIN', 'CASHIER')
      expect(result).toBe(true)
    })

    it('should return true for cashier accessing cashier resource', () => {
      const result = AuthService.hasPermission('CASHIER', 'CASHIER')
      expect(result).toBe(true)
    })

    it('should return false for cashier accessing admin resource', () => {
      const result = AuthService.hasPermission('CASHIER', 'ADMIN')
      expect(result).toBe(false)
    })
  })

  describe('canAccessOffice', () => {
    it('should return true for admin accessing any office', () => {
      const result = AuthService.canAccessOffice('ADMIN', [], 'office1')
      expect(result).toBe(true)
    })

    it('should return true for cashier accessing assigned office', () => {
      const result = AuthService.canAccessOffice('CASHIER', ['office1', 'office2'], 'office1')
      expect(result).toBe(true)
    })

    it('should return false for cashier accessing unassigned office', () => {
      const result = AuthService.canAccessOffice('CASHIER', ['office1', 'office2'], 'office3')
      expect(result).toBe(false)
    })
  })
})
