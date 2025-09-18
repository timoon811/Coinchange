import crypto from 'crypto'

export class EncryptionService {
  private static readonly ALGORITHM = 'aes-256-gcm'
  private static readonly KEY = process.env.ENCRYPTION_KEY!
  private static readonly IV_LENGTH = 16
  private static readonly AUTH_TAG_LENGTH = 16

  // Проверка ключа шифрования
  private static validateKey(): void {
    if (!this.KEY || this.KEY.length !== 64) {
      throw new Error('ENCRYPTION_KEY must be 64 characters long (32 bytes in hex)')
    }
  }

  static encrypt(text: string): string {
    this.validateKey()

    if (!text || text.length === 0) {
      throw new Error('Data to encrypt cannot be empty')
    }

    const iv = crypto.randomBytes(this.IV_LENGTH)
    const cipher = crypto.createCipherGCM(this.ALGORITHM, Buffer.from(this.KEY, 'hex'), iv) as any

    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    const authTag = cipher.getAuthTag()

    // Возвращаем IV + auth tag + encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted
  }

  static decrypt(encryptedText: string): string {
    this.validateKey()

    if (!encryptedText || encryptedText.length === 0) {
      throw new Error('Encrypted data cannot be empty')
    }

    const parts = encryptedText.split(':')
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format')
    }

    const iv = Buffer.from(parts[0], 'hex')
    const authTag = Buffer.from(parts[1], 'hex')
    const encrypted = parts[2]

    if (iv.length !== this.IV_LENGTH || authTag.length !== this.AUTH_TAG_LENGTH) {
      throw new Error('Invalid encrypted data format')
    }

    const decipher = crypto.createDecipherGCM(this.ALGORITHM, Buffer.from(this.KEY, 'hex'), iv) as any
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
  }

  // Маскировка данных для отображения
  static maskWalletAddress(address: string): string {
    if (!address || address.length < 10) return address
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  static maskCardNumber(cardNumber: string): string {
    // Убираем пробелы для обработки
    const cleanNumber = cardNumber.replace(/\s/g, '')

    // Проверяем формат карты
    if (!cleanNumber || cleanNumber.length !== 16 || !/^\d+$/.test(cleanNumber)) {
      return cardNumber
    }

    // Показываем первые 4 цифры, затем звездочки, затем последние 4
    const firstFour = cleanNumber.slice(0, 4)
    const lastFour = cleanNumber.slice(-4)
    return `${firstFour} **** **** ${lastFour}`
  }

  static maskPhoneNumber(phoneNumber: string): string {
    if (!phoneNumber || phoneNumber.length < 7) return phoneNumber
    return `${phoneNumber.slice(0, 3)} *** ** ${phoneNumber.slice(-2)}`
  }
}

// Экспортируем функции для обратной совместимости с тестами
export const encrypt = EncryptionService.encrypt.bind(EncryptionService)
export const decrypt = EncryptionService.decrypt.bind(EncryptionService)
export const maskSensitiveData = (data: string): string => {
  // Проверяем на null/undefined
  if (!data) return ''

  // Определяем тип данных по формату
  if (data.startsWith('0x') || data.length === 42) {
    return EncryptionService.maskWalletAddress(data)
  } else if (data.replace(/\s/g, '').length === 16 && /^\d+$/.test(data.replace(/\s/g, ''))) {
    return EncryptionService.maskCardNumber(data)
  } else if (data.startsWith('+') && data.length >= 10) {
    return EncryptionService.maskPhoneNumber(data)
  }
  return data
}
