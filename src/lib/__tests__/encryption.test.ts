import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'
import { encrypt, decrypt, maskSensitiveData } from '../encryption'

// Mock crypto
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(),
    createCipherGCM: vi.fn(),
    createDecipherGCM: vi.fn(),
    createHash: vi.fn(),
  },
}))

describe('Encryption Utils', () => {
  const mockKey = 'test-encryption-key-32-chars-long'
  const mockIv = Buffer.from('1234567890123456')

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ENCRYPTION_KEY = mockKey

    // Mock crypto.randomBytes
    vi.mocked(crypto.randomBytes).mockReturnValue(mockIv)

    // Mock crypto.createCipherGCM
    const mockCipher = {
      update: vi.fn().mockReturnValue(Buffer.from('encrypted')),
      final: vi.fn().mockReturnValue(Buffer.from('final')),
      getAuthTag: vi.fn().mockReturnValue(Buffer.from('1234567890123456')),
      setAAD: vi.fn(),
    }
    vi.mocked(crypto.createCipherGCM).mockReturnValue(mockCipher as any)

    // Mock crypto.createDecipherGCM
    const mockDecipher = {
      update: vi.fn().mockReturnValue(Buffer.from('decrypted')),
      final: vi.fn().mockReturnValue(Buffer.from('final')),
      setAuthTag: vi.fn(),
      setAAD: vi.fn(),
    }
    vi.mocked(crypto.createDecipherGCM).mockReturnValue(mockDecipher as any)
  })

  describe('encrypt', () => {
    it('should encrypt data successfully', () => {
      const data = 'sensitive data'

      const result = encrypt(data)

      expect(vi.mocked(crypto.randomBytes)).toHaveBeenCalledWith(16)
      expect(vi.mocked(crypto.createCipherGCM)).toHaveBeenCalled()
      expect(result).toMatch(/^[^:]+:[^:]+:[^:]+$/) // Should match format iv:authTag:encryptedData
    })

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY

      expect(() => encrypt('data')).toThrow('ENCRYPTION_KEY is not defined')
    })

    it('should throw error when data is empty', () => {
      process.env.ENCRYPTION_KEY = mockKey

      expect(() => encrypt('')).toThrow('Data to encrypt cannot be empty')
    })
  })

  describe('decrypt', () => {
    it('should decrypt data successfully', () => {
      const encryptedData = '31323334353637383930313233343536:31323334353637383930313233343536:encryptedfinal'

      const result = decrypt(encryptedData)

      expect(vi.mocked(crypto.createDecipherGCM)).toHaveBeenCalled()
      expect(result).toBe('decryptedfinal')
    })

    it('should throw error when ENCRYPTION_KEY is not set', () => {
      delete process.env.ENCRYPTION_KEY

      expect(() => decrypt('data')).toThrow('ENCRYPTION_KEY is not defined')
    })

    it('should throw error when encrypted data is invalid', () => {
      process.env.ENCRYPTION_KEY = mockKey

      expect(() => decrypt('')).toThrow('Encrypted data cannot be empty')
    })

    it('should throw error when encrypted data is too short', () => {
      process.env.ENCRYPTION_KEY = mockKey

      expect(() => decrypt('short')).toThrow('Invalid encrypted data format')
    })
  })

  describe('maskSensitiveData', () => {
    it('should mask wallet address correctly', () => {
      const wallet = '0x1234567890abcdef1234567890abcdef12345678'
      const result = maskSensitiveData(wallet)

      expect(result).toBe('0x1234...5678')
    })

    it('should mask card number correctly', () => {
      const cardNumber = '4111111111111111'
      const result = maskSensitiveData(cardNumber)

      expect(result).toBe('4111 **** **** 1111')
    })

    it('should mask short card number correctly', () => {
      const cardNumber = '411111111111'
      const result = maskSensitiveData(cardNumber)

      expect(result).toBe('411111111111')
    })

    it('should return original data if not wallet or card', () => {
      const data = 'regular text'
      const result = maskSensitiveData(data)

      expect(result).toBe(data)
    })

    it('should handle empty string', () => {
      const result = maskSensitiveData('')

      expect(result).toBe('')
    })

    it('should handle null or undefined', () => {
      expect(maskSensitiveData(null as any)).toBe('')
      expect(maskSensitiveData(undefined as any)).toBe('')
    })
  })
})