import winston from 'winston'
import fs from 'fs'
import path from 'path'

// Создаем директорию для логов если она не существует
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// Кастомный формат для читаемых логов
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`
    
    // Добавляем метаданные если они есть
    if (Object.keys(meta).length > 0) {
      log += ` | Meta: ${JSON.stringify(meta)}`
    }
    
    // Добавляем стек ошибки если есть
    if (stack) {
      log += `\nStack: ${stack}`
    }
    
    return log
  })
)

// Основной logger
const mainLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'crypto-crm',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    // Файл для ошибок
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
      format: customFormat,
    }),
    
    // Файл для всех логов
    new winston.transports.File({
      filename: path.join(logsDir, 'app.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 15,
      format: customFormat,
    }),
    
    // Файл для warning и выше
    new winston.transports.File({
      filename: path.join(logsDir, 'warnings.log'),
      level: 'warn',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      format: customFormat,
    }),
  ],
  
  // Обработка uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: customFormat,
    })
  ],
  
  // Обработка unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: customFormat,
    })
  ],
})

// В development режиме также выводим в консоль
if (process.env.NODE_ENV !== 'production') {
  mainLogger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'HH:mm:ss' }),
      winston.format.printf(({ level, message, timestamp, ...meta }) => {
        let log = `${timestamp} [${level}]: ${message}`
        if (Object.keys(meta).length > 0 && meta.service) {
          delete meta.service
          delete meta.version
          delete meta.environment
          if (Object.keys(meta).length > 0) {
            log += ` ${JSON.stringify(meta)}`
          }
        }
        return log
      })
    )
  }))
}

// Отдельный logger для безопасности
export const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'crypto-crm-security',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'security.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 20, // Больше файлов для безопасности
      format: customFormat,
    }),
  ],
})

// Отдельный logger для аудита
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'crypto-crm-audit',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 30, // Много файлов для аудита
      format: customFormat,
    }),
  ],
})

// Экспортируем улучшенные функции логирования
export const logger = {
  // Основные уровни логирования
  info: (message: string, meta?: any) => {
    mainLogger.info(message, meta)
  },
  
  warn: (message: string, meta?: any) => {
    mainLogger.warn(message, meta)
  },
  
  error: (message: string, meta?: any) => {
    mainLogger.error(message, meta)
  },
  
  debug: (message: string, meta?: any) => {
    mainLogger.debug(message, meta)
  },
  
  // Специальные функции для безопасности
  security: (event: string, details?: any) => {
    const securityEvent = {
      event,
      timestamp: new Date().toISOString(),
      severity: 'medium',
      ...details
    }
    
    securityLogger.info(event, securityEvent)
    
    // Критические события безопасности также дублируем в основной лог
    if (details?.severity === 'high' || details?.severity === 'critical') {
      mainLogger.warn(`SECURITY_EVENT: ${event}`, securityEvent)
    }
  },
  
  // Функция для аудита действий пользователей
  audit: (userId: string, action: string, entityType: string, entityId: string, details?: any) => {
    const auditEvent = {
      userId,
      action,
      entityType,
      entityId,
      timestamp: new Date().toISOString(),
      userAgent: details?.userAgent,
      ip: details?.ip,
      ...details
    }
    
    auditLogger.info(`AUDIT: ${action} on ${entityType}`, auditEvent)
  },
  
  // Функция для логирования API запросов
  apiRequest: (method: string, url: string, statusCode: number, responseTime?: number, meta?: any) => {
    mainLogger.info(`API ${method} ${url}`, {
      method,
      url,
      statusCode,
      responseTime,
      ...meta
    })
  },
  
  // Функция для логирования ошибок базы данных
  dbError: (operation: string, error: any, query?: string) => {
    mainLogger.error(`Database error during ${operation}`, {
      operation,
      error: error.message,
      stack: error.stack,
      query,
      timestamp: new Date().toISOString()
    })
  },
  
  // Функция для логирования производительности
  performance: (operation: string, duration: number, meta?: any) => {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug'
    mainLogger[level](`Performance: ${operation} took ${duration}ms`, {
      operation,
      duration,
      ...meta
    })
  },
  
  // Функция для rate limiting
  rateLimit: (ip: string, endpoint: string, userAgent?: string) => {
    securityLogger.warn('RATE_LIMIT_EXCEEDED', {
      ip,
      endpoint,
      userAgent,
      timestamp: new Date().toISOString(),
    })
  },
}

// Функция для получения детализированной информации об ошибках
export const logError = (error: Error, context?: string, meta?: any) => {
  mainLogger.error(`${context ? `[${context}] ` : ''}${error.message}`, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
    timestamp: new Date().toISOString(),
    ...meta
  })
}

// Функция для логирования начала/завершения операций
export const logOperation = (operation: string, status: 'start' | 'success' | 'error', meta?: any) => {
  const message = `Operation ${operation} ${status}`
  
  switch (status) {
    case 'start':
      mainLogger.info(message, { operation, status, ...meta })
      break
    case 'success':
      mainLogger.info(message, { operation, status, ...meta })
      break
    case 'error':
      mainLogger.error(message, { operation, status, ...meta })
      break
  }
}
