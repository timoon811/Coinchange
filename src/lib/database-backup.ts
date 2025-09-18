import { prisma } from './prisma'
import { logger } from './logger'
import fs from 'fs/promises'
import path from 'path'
import { spawn } from 'child_process'

interface BackupConfig {
  backupDirectory: string
  maxBackups: number
  compressionEnabled: boolean
  includeSchemaOnly: boolean
  includedTables?: string[]
  excludedTables?: string[]
  scheduleEnabled: boolean
  scheduleHour: number // час дня для автоматического бэкапа (0-23)
}

interface BackupResult {
  success: boolean
  filename?: string
  filePath?: string
  size?: number
  duration?: number
  tablesBackedUp?: string[]
  error?: string
}

interface BackupInfo {
  filename: string
  filePath: string
  size: number
  created: Date
  type: 'full' | 'schema' | 'data'
  tablesCount: number
  compressed: boolean
}

export class DatabaseBackup {
  private static readonly DEFAULT_CONFIG: BackupConfig = {
    backupDirectory: path.join(process.cwd(), 'backups'),
    maxBackups: 30,
    compressionEnabled: true,
    includeSchemaOnly: false,
    scheduleEnabled: true,
    scheduleHour: 2, // 2:00 AM
  }

  private static config: BackupConfig = { ...DatabaseBackup.DEFAULT_CONFIG }

  /**
   * Настройка конфигурации бэкапа
   */
  static configure(config: Partial<BackupConfig>): void {
    DatabaseBackup.config = { ...DatabaseBackup.config, ...config }
    logger.info('Database backup configuration updated', { config: DatabaseBackup.config })
  }

  /**
   * Создание директории для бэкапов
   */
  private static async ensureBackupDirectory(): Promise<void> {
    try {
      await fs.access(DatabaseBackup.config.backupDirectory)
    } catch {
      await fs.mkdir(DatabaseBackup.config.backupDirectory, { recursive: true })
      logger.info('Backup directory created', { directory: DatabaseBackup.config.backupDirectory })
    }
  }

  /**
   * Генерация имени файла бэкапа
   */
  private static generateBackupFilename(type: 'full' | 'schema' | 'data' = 'full'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const extension = DatabaseBackup.config.compressionEnabled ? '.sql.gz' : '.sql'
    return `backup_${type}_${timestamp}${extension}`
  }

  /**
   * Выполнение команды pg_dump
   */
  private static async executePgDump(options: {
    filename: string
    schemaOnly?: boolean
    dataOnly?: boolean
    tables?: string[]
  }): Promise<BackupResult> {
    return new Promise((resolve) => {
      const startTime = Date.now()
      const { filename, schemaOnly = false, dataOnly = false, tables } = options
      
      // Получаем URL базы данных из переменных окружения
      const databaseUrl = process.env.DATABASE_URL
      if (!databaseUrl) {
        resolve({
          success: false,
          error: 'DATABASE_URL not configured'
        })
        return
      }

      // Парсим URL для получения параметров подключения
      let dbParams: any = {}
      try {
        const url = new URL(databaseUrl)
        dbParams = {
          host: url.hostname,
          port: url.port || '5432',
          database: url.pathname.slice(1),
          username: url.username,
          password: url.password,
        }
      } catch (error) {
        resolve({
          success: false,
          error: 'Invalid DATABASE_URL format'
        })
        return
      }

      // Строим команду pg_dump
      const args = [
        '--host', dbParams.host,
        '--port', dbParams.port,
        '--username', dbParams.username,
        '--format', 'plain',
        '--no-password',
        '--verbose',
      ]

      if (schemaOnly) args.push('--schema-only')
      if (dataOnly) args.push('--data-only')
      
      if (tables && tables.length > 0) {
        tables.forEach(table => {
          args.push('--table', table)
        })
      }

      // Добавляем исключенные таблицы
      if (DatabaseBackup.config.excludedTables) {
        DatabaseBackup.config.excludedTables.forEach(table => {
          args.push('--exclude-table', table)
        })
      }

      args.push(dbParams.database)

      const outputPath = path.join(DatabaseBackup.config.backupDirectory, filename)
      
      // Запускаем pg_dump
      const pgDump = spawn('pg_dump', args, {
        env: { ...process.env, PGPASSWORD: dbParams.password }
      })

      let output = ''
      let errorOutput = ''

      pgDump.stdout.on('data', (data) => {
        output += data.toString()
      })

      pgDump.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      pgDump.on('close', async (code) => {
        const duration = Date.now() - startTime

        if (code !== 0) {
          logger.error('pg_dump failed', { 
            code, 
            error: errorOutput,
            duration
          })
          
          resolve({
            success: false,
            error: `pg_dump exited with code ${code}: ${errorOutput}`,
            duration
          })
          return
        }

        try {
          // Записываем результат в файл
          if (DatabaseBackup.config.compressionEnabled) {
            // В реальном приложении здесь должно быть сжатие
            // Пока просто записываем как есть
            await fs.writeFile(outputPath, output)
          } else {
            await fs.writeFile(outputPath, output)
          }

          const stats = await fs.stat(outputPath)
          
          resolve({
            success: true,
            filename,
            filePath: outputPath,
            size: stats.size,
            duration,
            tablesBackedUp: tables || ['all']
          })

        } catch (writeError) {
          logger.error('Failed to write backup file', { 
            file: outputPath, 
            error: writeError 
          })
          
          resolve({
            success: false,
            error: `Failed to write backup file: ${writeError}`,
            duration
          })
        }
      })

      pgDump.on('error', (error) => {
        logger.error('pg_dump process error', { error })
        resolve({
          success: false,
          error: `pg_dump process error: ${error.message}`,
          duration: Date.now() - startTime
        })
      })
    })
  }

  /**
   * Создание полного бэкапа базы данных
   */
  static async createFullBackup(): Promise<BackupResult> {
    logger.info('Starting full database backup')
    
    try {
      await DatabaseBackup.ensureBackupDirectory()
      
      const filename = DatabaseBackup.generateBackupFilename('full')
      const result = await DatabaseBackup.executePgDump({ filename })

      if (result.success) {
        logger.info('Full database backup completed', {
          filename: result.filename,
          size: result.size,
          duration: result.duration
        })

        // Очищаем старые бэкапы
        await DatabaseBackup.cleanupOldBackups()
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Full backup failed', { error: errorMessage })
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Создание бэкапа только схемы
   */
  static async createSchemaBackup(): Promise<BackupResult> {
    logger.info('Starting schema-only backup')
    
    try {
      await DatabaseBackup.ensureBackupDirectory()
      
      const filename = DatabaseBackup.generateBackupFilename('schema')
      const result = await DatabaseBackup.executePgDump({ 
        filename, 
        schemaOnly: true 
      })

      if (result.success) {
        logger.info('Schema backup completed', {
          filename: result.filename,
          size: result.size,
          duration: result.duration
        })
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Schema backup failed', { error: errorMessage })
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Создание бэкапа конкретных таблиц
   */
  static async createTableBackup(tables: string[]): Promise<BackupResult> {
    logger.info('Starting table backup', { tables })
    
    try {
      await DatabaseBackup.ensureBackupDirectory()
      
      const filename = DatabaseBackup.generateBackupFilename('data')
      const result = await DatabaseBackup.executePgDump({ 
        filename, 
        tables 
      })

      if (result.success) {
        logger.info('Table backup completed', {
          filename: result.filename,
          tables,
          size: result.size,
          duration: result.duration
        })
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('Table backup failed', { error: errorMessage, tables })
      
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  /**
   * Получение списка существующих бэкапов
   */
  static async getBackupsList(): Promise<BackupInfo[]> {
    try {
      const files = await fs.readdir(DatabaseBackup.config.backupDirectory)
      const backups: BackupInfo[] = []

      for (const file of files) {
        if (file.startsWith('backup_') && (file.endsWith('.sql') || file.endsWith('.sql.gz'))) {
          const filePath = path.join(DatabaseBackup.config.backupDirectory, file)
          
          try {
            const stats = await fs.stat(filePath)
            
            // Определяем тип бэкапа из имени файла
            let type: 'full' | 'schema' | 'data' = 'full'
            if (file.includes('_schema_')) type = 'schema'
            else if (file.includes('_data_')) type = 'data'

            backups.push({
              filename: file,
              filePath,
              size: stats.size,
              created: stats.birthtime,
              type,
              tablesCount: 0, // Можно добавить анализ содержимого файла
              compressed: file.endsWith('.gz')
            })
          } catch (statError) {
            logger.warn('Failed to get stats for backup file', { file, error: statError })
          }
        }
      }

      return backups.sort((a, b) => b.created.getTime() - a.created.getTime())

    } catch (error) {
      logger.error('Failed to list backups', { error })
      return []
    }
  }

  /**
   * Очистка старых бэкапов
   */
  static async cleanupOldBackups(): Promise<number> {
    try {
      const backups = await DatabaseBackup.getBackupsList()
      
      if (backups.length <= DatabaseBackup.config.maxBackups) {
        return 0
      }

      const backupsToDelete = backups.slice(DatabaseBackup.config.maxBackups)
      let deletedCount = 0

      for (const backup of backupsToDelete) {
        try {
          await fs.unlink(backup.filePath)
          deletedCount++
          
          logger.debug('Old backup deleted', {
            filename: backup.filename,
            age: Date.now() - backup.created.getTime()
          })
        } catch (deleteError) {
          logger.error('Failed to delete old backup', {
            filename: backup.filename,
            error: deleteError
          })
        }
      }

      if (deletedCount > 0) {
        logger.info('Old backups cleanup completed', { deletedCount })
      }

      return deletedCount

    } catch (error) {
      logger.error('Backup cleanup failed', { error })
      return 0
    }
  }

  /**
   * Восстановление из бэкапа
   */
  static async restoreFromBackup(backupFilePath: string): Promise<BackupResult> {
    logger.warn('Database restore initiated', { backupFilePath })
    
    // Восстановление - критическая операция, требует дополнительной осторожности
    // В продакшене нужно добавить дополнительные проверки и подтверждения
    
    return {
      success: false,
      error: 'Restore functionality not implemented for safety reasons. Please use manual pg_restore.'
    }
  }

  /**
   * Проверка целостности бэкапа
   */
  static async verifyBackup(backupFilePath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(backupFilePath)
      
      // Проверяем что файл не пустой
      if (stats.size === 0) {
        return false
      }

      // Можно добавить дополнительные проверки:
      // - проверка формата файла
      // - проверка на наличие ключевых SQL команд
      // - проверка целостности сжатого файла
      
      return true

    } catch (error) {
      logger.error('Backup verification failed', { backupFilePath, error })
      return false
    }
  }

  /**
   * Автоматический бэкап по расписанию
   */
  static startScheduledBackup(): void {
    if (!DatabaseBackup.config.scheduleEnabled) {
      return
    }

    const scheduleHour = DatabaseBackup.config.scheduleHour
    const now = new Date()
    const scheduledTime = new Date()
    scheduledTime.setHours(scheduleHour, 0, 0, 0)

    // Если время уже прошло, планируем на завтра
    if (scheduledTime <= now) {
      scheduledTime.setDate(scheduledTime.getDate() + 1)
    }

    const timeUntilBackup = scheduledTime.getTime() - now.getTime()

    setTimeout(() => {
      // Запускаем бэкап
      DatabaseBackup.createFullBackup()
        .then(result => {
          if (result.success) {
            logger.info('Scheduled backup completed successfully', result)
          } else {
            logger.error('Scheduled backup failed', result)
          }
        })
        .catch(error => {
          logger.error('Scheduled backup error', { error })
        })

      // Планируем следующий бэкап через 24 часа
      setInterval(() => {
        DatabaseBackup.createFullBackup()
      }, 24 * 60 * 60 * 1000)

    }, timeUntilBackup)

    logger.info('Scheduled backup configured', {
      nextBackup: scheduledTime.toISOString(),
      timeUntilBackup: Math.round(timeUntilBackup / (60 * 1000))
    })
  }

  /**
   * Получение статистики бэкапов
   */
  static async getBackupStats(): Promise<{
    totalBackups: number
    totalSizeMB: number
    oldestBackup: Date | null
    newestBackup: Date | null
    lastBackupResult: BackupResult | null
    nextScheduledBackup: Date | null
  }> {
    const backups = await DatabaseBackup.getBackupsList()
    
    const totalSizeMB = Math.round(
      backups.reduce((sum, backup) => sum + backup.size, 0) / (1024 * 1024) * 100
    ) / 100

    const nextScheduledBackup = DatabaseBackup.config.scheduleEnabled ? 
      (() => {
        const next = new Date()
        next.setHours(DatabaseBackup.config.scheduleHour, 0, 0, 0)
        if (next <= new Date()) {
          next.setDate(next.getDate() + 1)
        }
        return next
      })() : null

    return {
      totalBackups: backups.length,
      totalSizeMB,
      oldestBackup: backups.length > 0 ? 
        new Date(Math.min(...backups.map(b => b.created.getTime()))) : null,
      newestBackup: backups.length > 0 ? 
        new Date(Math.max(...backups.map(b => b.created.getTime()))) : null,
      lastBackupResult: null, // Можно сохранять в кеше
      nextScheduledBackup
    }
  }
}

// Автоматический запуск планировщика бэкапов при импорте модуля
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  DatabaseBackup.startScheduledBackup()
}
