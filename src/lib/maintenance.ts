import { CacheService } from './cache'
import { RateLimit } from './rate-limit'
import { logger } from './logger'
import { prisma } from './prisma'

export class MaintenanceService {
  // Очистка кеша
  static clearCache(): void {
    CacheService.clear()
    logger.info('Cache cleared successfully')
  }

  // Очистка устаревших записей rate limiting
  static clearRateLimitStore(): void {
    RateLimit.cleanup()
    logger.info('Rate limit store cleaned up')
  }

  // Полная очистка всех кешей и временных данных
  static async fullCleanup(): Promise<void> {
    try {
      // Очистка кеша приложения
      this.clearCache()

      // Очистка rate limiting
      this.clearRateLimitStore()

      // Очистка устаревших сессий (если есть)
      // const deletedSessions = await prisma.session.deleteMany({
      //   where: {
      //     expiresAt: {
      //       lt: new Date()
      //     }
      //   }
      // })
      // logger.info(`Cleaned up ${deletedSessions.count} expired sessions`)

      logger.info('Full cleanup completed successfully')
    } catch (error) {
      logger.error('Error during full cleanup:', error)
      throw error
    }
  }

  // Получение статистики системы
  static async getSystemStats() {
    const cacheStats = CacheService.getStats()
    const memoryUsage = process.memoryUsage()

    return {
      cache: cacheStats,
      memory: {
        used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
        total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
      },
      uptime: `${Math.round(process.uptime() / 60)} minutes`,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    }
  }

  // Проверка здоровья системы
  static async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Проверка подключения к БД
      await prisma.$queryRaw`SELECT 1`
    } catch (error) {
      issues.push('Database connection failed')
      recommendations.push('Check database configuration and connectivity')
    }

    // Проверка памяти
    const memoryUsage = process.memoryUsage()
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

    if (memoryUsagePercent > 80) {
      issues.push(`High memory usage: ${memoryUsagePercent.toFixed(1)}%`)
      recommendations.push('Monitor memory usage and consider optimization')
    }

    // Проверка размера кеша
    const cacheStats = CacheService.getStats()
    if (cacheStats.size > 1000) {
      issues.push(`Large cache size: ${cacheStats.size} entries`)
      recommendations.push('Consider cache optimization or cleanup')
    }

    // Определение статуса
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    if (issues.length > 0) {
      status = issues.length > 2 ? 'unhealthy' : 'degraded'
    }

    return {
      status,
      issues,
      recommendations,
    }
  }

  // Резервное копирование настроек (пример)
  static async backupSettings(): Promise<void> {
    try {
      // Получаем важные настройки
      const settings = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        version: process.env.npm_package_version,
        database: {
          url: process.env.DATABASE_URL ? 'configured' : 'missing',
        },
        security: {
          jwtSecret: process.env.JWT_SECRET ? 'configured' : 'missing',
          encryptionKey: process.env.ENCRYPTION_KEY ? 'configured' : 'missing',
        },
      }

      // Сохраняем в файл или отправляем куда-то
      logger.info('Settings backup created', settings)

    } catch (error) {
      logger.error('Error creating settings backup:', error)
      throw error
    }
  }
}

// Запуск периодической очистки каждые 30 минут
if (typeof global !== 'undefined') {
  setInterval(() => {
    MaintenanceService.clearRateLimitStore()
  }, 30 * 60 * 1000) // 30 минут

  // Ежедневная полная очистка в 3:00 ночи
  const now = new Date()
  const nextCleanup = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 3, 0, 0)
  const timeUntilCleanup = nextCleanup.getTime() - now.getTime()

  setTimeout(() => {
    MaintenanceService.fullCleanup().catch(console.error)

    // Повторяем ежедневно
    setInterval(() => {
      MaintenanceService.fullCleanup().catch(console.error)
    }, 24 * 60 * 60 * 1000) // 24 часа
  }, timeUntilCleanup)
}
