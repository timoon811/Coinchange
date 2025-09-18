import { Server as HttpServer } from 'http'
import { Server as SocketIOServer, Socket } from 'socket.io'
import { AuthService } from './auth'
import { UserRole } from '@prisma/client'
import { logger } from './logger'

export interface WebSocketServer {
  io: SocketIOServer
  broadcastToUser: (userId: string, event: string, data: any) => void
  broadcastToRole: (role: UserRole, event: string, data: any) => void
  broadcastToOffice: (officeId: string, event: string, data: any) => void
  broadcastGlobal: (event: string, data: any) => void
}

interface AuthenticatedSocket extends Socket {
  userId?: string
  userRole?: UserRole
  officeIds?: string[]
}

interface ConnectedUser {
  socketId: string
  userId: string
  userRole: UserRole
  officeIds?: string[]
  connectedAt: Date
}

let webSocketServer: WebSocketServer | null = null
const connectedUsers = new Map<string, ConnectedUser>()

export function initializeWebSocketServer(httpServer: HttpServer): WebSocketServer {
  if (webSocketServer) {
    return webSocketServer
  }

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.NEXT_PUBLIC_APP_URL 
        : ["http://localhost:3000", "http://127.0.0.1:3000"],
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  })

  // Middleware для аутентификации
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '')
      
      if (!token) {
        logger.warn('WebSocket connection attempt without token', {
          socketId: socket.id,
          ip: socket.handshake.address
        })
        return next(new Error('Authentication failed: No token provided'))
      }

      const payload = await AuthService.verifyToken(token)
      
      socket.userId = payload.userId
      socket.userRole = payload.role
      socket.officeIds = payload.officeIds

      logger.info('WebSocket authenticated', {
        socketId: socket.id,
        userId: payload.userId,
        userRole: payload.role,
        officeIds: payload.officeIds
      })

      next()
    } catch (error) {
      logger.error('WebSocket authentication failed', {
        socketId: socket.id,
        error: error instanceof Error ? error.message : String(error),
        ip: socket.handshake.address
      })
      next(new Error('Authentication failed'))
    }
  })

  // Обработка подключений
  io.on('connection', (socket: AuthenticatedSocket) => {
    if (!socket.userId || !socket.userRole) {
      socket.disconnect()
      return
    }

    // Добавляем пользователя в список подключенных
    connectedUsers.set(socket.id, {
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
      officeIds: socket.officeIds,
      connectedAt: new Date()
    })

    // Присоединяем к комнатам на основе роли и офисов
    socket.join(`user:${socket.userId}`)
    socket.join(`role:${socket.userRole}`)
    
    if (socket.officeIds && socket.officeIds.length > 0) {
      socket.officeIds.forEach(officeId => {
        socket.join(`office:${officeId}`)
      })
    }

    logger.info('WebSocket user connected', {
      socketId: socket.id,
      userId: socket.userId,
      userRole: socket.userRole,
      totalConnections: connectedUsers.size
    })

    // Отправляем подтверждение подключения
    socket.emit('connected', {
      userId: socket.userId,
      role: socket.userRole,
      connectedAt: new Date(),
      serverTime: new Date()
    })

    // Обработка пинга для проверки соединения
    socket.on('ping', (callback) => {
      if (typeof callback === 'function') {
        callback({ pong: true, serverTime: new Date() })
      }
    })

    // Обработка подписки на события
    socket.on('subscribe', (data: { events: string[] }) => {
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach(event => {
          socket.join(`event:${event}`)
        })
        socket.emit('subscribed', { events: data.events })
        
        logger.debug('User subscribed to events', {
          userId: socket.userId,
          events: data.events
        })
      }
    })

    // Обработка отписки от событий
    socket.on('unsubscribe', (data: { events: string[] }) => {
      if (data.events && Array.isArray(data.events)) {
        data.events.forEach(event => {
          socket.leave(`event:${event}`)
        })
        socket.emit('unsubscribed', { events: data.events })
        
        logger.debug('User unsubscribed from events', {
          userId: socket.userId,
          events: data.events
        })
      }
    })

    // Обработка отключения
    socket.on('disconnect', (reason) => {
      connectedUsers.delete(socket.id)
      
      logger.info('WebSocket user disconnected', {
        socketId: socket.id,
        userId: socket.userId,
        reason,
        totalConnections: connectedUsers.size
      })
    })

    // Обработка ошибок
    socket.on('error', (error) => {
      logger.error('WebSocket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error instanceof Error ? error.message : String(error)
      })
    })
  })

  // Создаем объект сервера с методами
  webSocketServer = {
    io,

    // Отправка сообщения конкретному пользователю
    broadcastToUser: (userId: string, event: string, data: any) => {
      io.to(`user:${userId}`).emit(event, {
        ...data,
        timestamp: new Date(),
        type: 'user_notification'
      })
      
      logger.debug('Broadcast to user', {
        userId,
        event,
        dataType: typeof data
      })
    },

    // Отправка сообщения пользователям с определенной ролью
    broadcastToRole: (role: UserRole, event: string, data: any) => {
      io.to(`role:${role}`).emit(event, {
        ...data,
        timestamp: new Date(),
        type: 'role_notification'
      })
      
      logger.debug('Broadcast to role', {
        role,
        event,
        dataType: typeof data
      })
    },

    // Отправка сообщения пользователям из определенного офиса
    broadcastToOffice: (officeId: string, event: string, data: any) => {
      io.to(`office:${officeId}`).emit(event, {
        ...data,
        timestamp: new Date(),
        type: 'office_notification'
      })
      
      logger.debug('Broadcast to office', {
        officeId,
        event,
        dataType: typeof data
      })
    },

    // Глобальная отправка всем подключенным пользователям
    broadcastGlobal: (event: string, data: any) => {
      io.emit(event, {
        ...data,
        timestamp: new Date(),
        type: 'global_notification'
      })
      
      logger.debug('Global broadcast', {
        event,
        dataType: typeof data,
        totalConnections: connectedUsers.size
      })
    }
  }

  // Периодическая очистка неактивных соединений
  setInterval(() => {
    const now = new Date()
    const expiredConnections: string[] = []
    
    connectedUsers.forEach((user, socketId) => {
      const connectionAge = now.getTime() - user.connectedAt.getTime()
      // Удаляем соединения старше 24 часов
      if (connectionAge > 24 * 60 * 60 * 1000) {
        expiredConnections.push(socketId)
      }
    })
    
    expiredConnections.forEach(socketId => {
      const socket = io.sockets.sockets.get(socketId)
      if (socket) {
        socket.disconnect(true)
      }
      connectedUsers.delete(socketId)
    })
    
    if (expiredConnections.length > 0) {
      logger.info('Cleaned up expired WebSocket connections', {
        cleanedCount: expiredConnections.length,
        totalConnections: connectedUsers.size
      })
    }
  }, 60 * 60 * 1000) // Проверяем каждый час

  logger.info('WebSocket server initialized', {
    cors: io.engine.opts.cors,
    transports: io.engine.opts.transports
  })

  return webSocketServer
}

export function getWebSocketServer(): WebSocketServer | null {
  return webSocketServer
}

// Функции-помощники для отправки уведомлений
export const NotificationService = {
  // Уведомление о новой заявке
  notifyNewRequest: (requestData: any, officeId?: string) => {
    if (!webSocketServer) return

    // Уведомляем администраторов и менеджеров
    webSocketServer.broadcastToRole(UserRole.ADMIN, 'request:new', {
      request: requestData,
      message: 'Новая заявка создана'
    })
    
    webSocketServer.broadcastToRole(UserRole.MANAGER, 'request:new', {
      request: requestData,
      message: 'Новая заявка создана'
    })

    // Уведомляем пользователей конкретного офиса
    if (officeId) {
      webSocketServer.broadcastToOffice(officeId, 'request:new', {
        request: requestData,
        message: 'Новая заявка в вашем офисе'
      })
    }
  },

  // Уведомление об изменении статуса заявки
  notifyRequestStatusChange: (requestData: any, oldStatus: string, newStatus: string) => {
    if (!webSocketServer) return

    const notificationData = {
      request: requestData,
      oldStatus,
      newStatus,
      message: `Статус заявки изменен: ${oldStatus} → ${newStatus}`
    }

    // Уведомляем клиента
    if (requestData.clientId) {
      webSocketServer.broadcastToUser(requestData.clientId, 'request:status_changed', notificationData)
    }

    // Уведомляем назначенного пользователя
    if (requestData.assignedUserId) {
      webSocketServer.broadcastToUser(requestData.assignedUserId, 'request:status_changed', notificationData)
    }

    // Уведомляем администраторов
    webSocketServer.broadcastToRole(UserRole.ADMIN, 'request:status_changed', notificationData)
  },

  // Уведомление о просрочке SLA
  notifySLAViolation: (requestData: any) => {
    if (!webSocketServer) return

    const notificationData = {
      request: requestData,
      message: 'Нарушение SLA! Заявка просрочена',
      severity: 'high'
    }

    // Уведомляем администраторов и менеджеров
    webSocketServer.broadcastToRole(UserRole.ADMIN, 'sla:violation', notificationData)
    webSocketServer.broadcastToRole(UserRole.MANAGER, 'sla:violation', notificationData)

    // Уведомляем назначенного пользователя
    if (requestData.assignedUserId) {
      webSocketServer.broadcastToUser(requestData.assignedUserId, 'sla:violation', notificationData)
    }
  },

  // Системное уведомление
  notifySystemMessage: (message: string, severity: 'info' | 'warning' | 'error' = 'info', targetRole?: UserRole) => {
    if (!webSocketServer) return

    const notificationData = {
      message,
      severity,
      type: 'system'
    }

    if (targetRole) {
      webSocketServer.broadcastToRole(targetRole, 'system:message', notificationData)
    } else {
      webSocketServer.broadcastGlobal('system:message', notificationData)
    }
  },

  // Получение статистики подключений
  getConnectionStats: () => {
    return {
      totalConnections: connectedUsers.size,
      usersByRole: Array.from(connectedUsers.values()).reduce((acc, user) => {
        acc[user.userRole] = (acc[user.userRole] || 0) + 1
        return acc
      }, {} as Record<UserRole, number>),
      users: Array.from(connectedUsers.values()).map(user => ({
        userId: user.userId,
        role: user.userRole,
        connectedAt: user.connectedAt,
        officeIds: user.officeIds
      }))
    }
  }
}
