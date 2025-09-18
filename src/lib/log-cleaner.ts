import fs from 'fs/promises'
import path from 'path'
import { logger } from './logger'
import { CacheService } from './cache'

interface LogCleanupConfig {
  logsDirectory: string
  maxAgeInDays: number
  maxSizeInMB: number
  maxFiles: number
  compressionEnabled: boolean
  archiveOldLogs: boolean
  cleanupSchedule: string // cron-like schedule
}

interface LogFileInfo {
  name: string
  path: string
  size: number
  modified: Date
  type: 'log' | 'archive'
}

interface CleanupResult {
  totalFiles: number
  deletedFiles: number
  archivedFiles: number
  compressedFiles: number
  freedSpaceMB: number
  errors: string[]
}

export class LogCleaner {
  private static readonly DEFAULT_CONFIG: LogCleanupConfig = {
    logsDirectory: path.join(process.cwd(), 'logs'),
    maxAgeInDays: 30,
    maxSizeInMB: 100,
    maxFiles: 50,
    compressionEnabled: true,
    archiveOldLogs: true,
    cleanupSchedule: '0 2 * * *' // Каждый день в 2:00
  }

  private static config: LogCleanupConfig = { ...LogCleaner.DEFAULT_CONFIG }

  /**
   * Настройка конфигурации очистки логов
   */
  static configure(config: Partial<LogCleanupConfig>): void {
    LogCleaner.config = { ...LogCleaner.config, ...config }
    logger.info('Log cleaner configuration updated', { config: LogCleaner.config })
  }

  /**
   * Получение информации о лог файлах
   */
  static async getLogFiles(): Promise<LogFileInfo[]> {
    try {
      const files = await fs.readdir(LogCleaner.config.logsDirectory)
      const logFiles: LogFileInfo[] = []

      for (const file of files) {
        if (file.endsWith('.log') || file.endsWith('.log.gz') || file.endsWith('.log.archive')) {
          const filePath = path.join(LogCleaner.config.logsDirectory, file)
          
          try {
            const stats = await fs.stat(filePath)
            
            logFiles.push({
              name: file,
              path: filePath,
              size: stats.size,
              modified: stats.mtime,
              type: file.includes('.gz') || file.includes('.archive') ? 'archive' : 'log'
            })
          } catch (error) {
            logger.warn('Failed to get stats for log file', { file, error })
          }
        }
      }

      return logFiles.sort((a, b) => b.modified.getTime() - a.modified.getTime())
    } catch (error) {
      logger.error('Failed to read logs directory', { 
        directory: LogCleaner.config.logsDirectory, 
        error 
      })
      return []
    }
  }

  /**
   * Проверка необходимости очистки
   */
  static async shouldCleanup(): Promise<boolean> {
    const logFiles = await LogCleaner.getLogFiles()
    
    // Проверяем по количеству файлов
    if (logFiles.length > LogCleaner.config.maxFiles) {
      return true
    }

    // Проверяем по общему размеру
    const totalSizeMB = logFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024)
    if (totalSizeMB > LogCleaner.config.maxSizeInMB) {
      return true
    }

    // Проверяем по возрасту файлов
    const maxAge = LogCleaner.config.maxAgeInDays * 24 * 60 * 60 * 1000
    const now = Date.now()
    
    const hasOldFiles = logFiles.some(file => 
      now - file.modified.getTime() > maxAge
    )

    return hasOldFiles
  }

  /**
   * Архивирование лог файла
   */
  static async archiveLogFile(filePath: string): Promise<string | null> {
    try {
      const archivePath = `${filePath}.archive.${Date.now()}`
      await fs.rename(filePath, archivePath)
      
      logger.debug('Log file archived', { 
        original: filePath, 
        archive: archivePath 
      })
      
      return archivePath
    } catch (error) {
      logger.error('Failed to archive log file', { filePath, error })
      return null
    }
  }

  /**
   * Сжатие лог файла (имитация - в реальности нужна библиотека сжатия)
   */
  static async compressLogFile(filePath: string): Promise<string | null> {
    try {
      // В реальном приложении здесь должно быть сжатие файла
      // Например, с помощью библиотеки zlib или gzip
      const compressedPath = `${filePath}.gz`
      
      // Имитируем сжатие копированием файла
      const content = await fs.readFile(filePath)
      await fs.writeFile(compressedPath, content)
      await fs.unlink(filePath)
      
      logger.debug('Log file compressed', { 
        original: filePath, 
        compressed: compressedPath 
      })
      
      return compressedPath
    } catch (error) {
      logger.error('Failed to compress log file', { filePath, error })
      return null
    }
  }

  /**
   * Удаление старых лог файлов
   */
  static async deleteOldFiles(files: LogFileInfo[]): Promise<number> {
    const maxAge = LogCleaner.config.maxAgeInDays * 24 * 60 * 60 * 1000
    const now = Date.now()
    let deletedCount = 0

    for (const file of files) {
      if (now - file.modified.getTime() > maxAge) {
        try {
          await fs.unlink(file.path)
          deletedCount++
          
          logger.debug('Old log file deleted', { 
            file: file.name, 
            age: Math.round((now - file.modified.getTime()) / (24 * 60 * 60 * 1000)) 
          })
        } catch (error) {
          logger.error('Failed to delete old log file', { 
            file: file.name, 
            error 
          })
        }
      }
    }

    return deletedCount
  }

  /**
   * Удаление файлов по лимиту количества
   */
  static async deleteExcessFiles(files: LogFileInfo[]): Promise<number> {
    if (files.length <= LogCleaner.config.maxFiles) {
      return 0
    }

    // Сортируем по дате модификации (старые сначала)
    const sortedFiles = [...files].sort((a, b) => a.modified.getTime() - b.modified.getTime())
    const filesToDelete = sortedFiles.slice(0, files.length - LogCleaner.config.maxFiles)
    
    let deletedCount = 0

    for (const file of filesToDelete) {
      try {
        await fs.unlink(file.path)
        deletedCount++
        
        logger.debug('Excess log file deleted', { file: file.name })
      } catch (error) {
        logger.error('Failed to delete excess log file', { 
          file: file.name, 
          error 
        })
      }
    }

    return deletedCount
  }

  /**
   * Основная функция очистки логов
   */
  static async cleanup(): Promise<CleanupResult> {
    const startTime = Date.now()
    
    logger.info('Starting log cleanup', { config: LogCleaner.config })
    
    const result: CleanupResult = {
      totalFiles: 0,
      deletedFiles: 0,
      archivedFiles: 0,
      compressedFiles: 0,
      freedSpaceMB: 0,
      errors: []
    }

    try {
      // Получаем список всех лог файлов
      const logFiles = await LogCleaner.getLogFiles()
      result.totalFiles = logFiles.length

      if (logFiles.length === 0) {
        logger.info('No log files found for cleanup')
        return result
      }

      // Вычисляем размер до очистки
      const initialSizeBytes = logFiles.reduce((sum, file) => sum + file.size, 0)

      // Удаляем старые файлы
      result.deletedFiles += await LogCleaner.deleteOldFiles(logFiles)

      // Обновляем список файлов после удаления старых
      const remainingFiles = await LogCleaner.getLogFiles()

      // Удаляем лишние файлы по количеству
      result.deletedFiles += await LogCleaner.deleteExcessFiles(remainingFiles)

      // Архивируем и сжимаем большие файлы
      const finalFiles = await LogCleaner.getLogFiles()
      const maxFileSizeBytes = 10 * 1024 * 1024 // 10 MB

      for (const file of finalFiles) {
        if (file.size > maxFileSizeBytes && file.type === 'log') {
          if (LogCleaner.config.archiveOldLogs) {
            const archivedPath = await LogCleaner.archiveLogFile(file.path)
            if (archivedPath) {
              result.archivedFiles++
              
              if (LogCleaner.config.compressionEnabled) {
                const compressedPath = await LogCleaner.compressLogFile(archivedPath)
                if (compressedPath) {
                  result.compressedFiles++
                }
              }
            }
          }
        }
      }

      // Вычисляем освобожденное место
      const finalSizeBytes = (await LogCleaner.getLogFiles())
        .reduce((sum, file) => sum + file.size, 0)
      
      result.freedSpaceMB = Math.round((initialSizeBytes - finalSizeBytes) / (1024 * 1024) * 100) / 100

      // Обновляем статистику в кеше
      CacheService.set('log_cleanup_stats', {
        lastCleanup: new Date().toISOString(),
        ...result
      }, 24 * 60 * 60 * 1000) // 24 часа

      const duration = Date.now() - startTime

      logger.info('Log cleanup completed', { 
        ...result, 
        duration: `${duration}ms` 
      })

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(errorMessage)
      
      logger.error('Log cleanup failed', { error: errorMessage })
      return result
    }
  }

  /**
   * Получение статистики о логах
   */
  static async getLogStats(): Promise<{
    totalFiles: number
    totalSizeMB: number
    oldestFile: Date | null
    newestFile: Date | null
    filesByType: Record<string, number>
    lastCleanup: string | null
  }> {
    const logFiles = await LogCleaner.getLogFiles()
    
    const totalSizeMB = Math.round(
      logFiles.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024) * 100
    ) / 100

    const filesByType = logFiles.reduce((acc, file) => {
      acc[file.type] = (acc[file.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const lastCleanupData = CacheService.get('log_cleanup_stats')

    return {
      totalFiles: logFiles.length,
      totalSizeMB,
      oldestFile: logFiles.length > 0 ? 
        new Date(Math.min(...logFiles.map(f => f.modified.getTime()))) : null,
      newestFile: logFiles.length > 0 ? 
        new Date(Math.max(...logFiles.map(f => f.modified.getTime()))) : null,
      filesByType,
      lastCleanup: lastCleanupData?.lastCleanup || null
    }
  }

  /**
   * Запуск автоматической очистки по расписанию
   */
  static startScheduledCleanup(): void {
    // В реальном приложении здесь должна быть интеграция с cron
    // Например, с помощью библиотеки node-cron
    
    const cleanupInterval = 24 * 60 * 60 * 1000 // 24 часа
    
    setInterval(async () => {
      try {
        const shouldClean = await LogCleaner.shouldCleanup()
        
        if (shouldClean) {
          logger.info('Scheduled log cleanup triggered')
          await LogCleaner.cleanup()
        } else {
          logger.debug('Scheduled log cleanup skipped - no cleanup needed')
        }
      } catch (error) {
        logger.error('Scheduled log cleanup failed', { error })
      }
    }, cleanupInterval)

    logger.info('Scheduled log cleanup started', { 
      interval: `${cleanupInterval / (60 * 60 * 1000)} hours` 
    })
  }
}

// Автоматический запуск планировщика очистки при импорте модуля
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  LogCleaner.startScheduledCleanup()
}
