import { UserRole } from '@prisma/client'

export interface User {
  id: string
  username: string
  email?: string | null
  firstName: string
  lastName?: string | null
  role: UserRole
  officeIds: string[]
  isActive: boolean
  notificationPrefs?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

export class AuthClient {
  static async login(username: string, password: string): Promise<{ user: User } | { error: string }> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include', // Важно для cookies
      })

      const data = await response.json()

      if (!response.ok) {
        return { error: data.error || 'Ошибка авторизации' }
      }

      return { user: data.user }
    } catch (error) {
      console.error('Login error:', error)
      return { error: 'Ошибка подключения' }
    }
  }

  static async logout(): Promise<void> {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include', // Важно для cookies
      })
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  static async getCurrentUser(): Promise<User | null> {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include', // Важно для cookies
      })
      const data = await response.json()

      if (!response.ok) {
        return null
      }

      return data.user
    } catch (error) {
      console.error('Get current user error:', error)
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
}
