import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { UserRole } from '@prisma/client'

export interface JWTPayload {
  userId: string
  username: string
  role: UserRole
  officeIds?: string[]
}

export class AuthService {
  private static readonly JWT_SECRET = process.env.JWT_SECRET
  private static readonly JWT_EXPIRE = process.env.JWT_EXPIRE || '7d'

  private static validateSecret(): void {
    if (!this.JWT_SECRET || this.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters long')
    }
  }

  static async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long')
    }
    return bcrypt.hash(password, 12)
  }

  static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword)
  }

  static generateToken(payload: JWTPayload): string {
    this.validateSecret()
    return jwt.sign(payload, this.JWT_SECRET!, { expiresIn: this.JWT_EXPIRE } as jwt.SignOptions)
  }

  static verifyToken(token: string): JWTPayload | null {
    this.validateSecret()
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET!) as JWTPayload
      // Проверяем обязательные поля
      if (!decoded.userId || !decoded.username || !decoded.role) {
        return null
      }
      return decoded
    } catch {
      return null
    }
  }

  static hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    const roleHierarchy = {
      [UserRole.CASHIER]: 1,
      [UserRole.ADMIN]: 2
    }

    return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
  }

  static canAccessOffice(userRole: UserRole, userOfficeIds: string[], officeId: string): boolean {
    // Админ имеет доступ ко всем офисам
    if (userRole === UserRole.ADMIN) return true

    // Кассир имеет доступ только к назначенным офисам
    return userOfficeIds.includes(officeId)
  }

  static async authenticateRequest(request: Request): Promise<JWTPayload> {
    // Сначала пробуем получить токен из Authorization header
    const authHeader = request.headers.get('authorization')
    let token: string | null = null
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    } else {
      // Если нет Bearer токена, ищем в cookies
      const cookies = request.headers.get('cookie') || ''
      token = this.extractTokenFromCookies(cookies)
    }

    if (!token) {
      throw new Error('Не авторизован')
    }

    const payload = this.verifyToken(token)
    if (!payload) {
      throw new Error('Недействительный токен')
    }

    return payload
  }

  private static extractTokenFromCookies(cookieHeader: string): string | null {
    const cookies = cookieHeader.split(';').map(c => c.trim())
    const authCookie = cookies.find(c => c.startsWith('auth-token='))
    return authCookie ? authCookie.split('=')[1] : null
  }
}
