"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useIsMounted } from '@/hooks/use-is-mounted'
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  AlertTriangle,
  User,
  FileText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { NotificationType } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'

interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  payload?: Record<string, unknown>
  isRead: boolean
  createdAt: string
}

const notificationIcons = {
  [NotificationType.NEW_REQUEST]: User,
  [NotificationType.SLA_OVERDUE]: AlertTriangle,
  [NotificationType.STATUS_CHANGE]: FileText,
  [NotificationType.ASSIGNMENT]: User,
  [NotificationType.SYSTEM]: Bell,
}

const notificationColors = {
  [NotificationType.NEW_REQUEST]: 'text-blue-500',
  [NotificationType.SLA_OVERDUE]: 'text-red-500',
  [NotificationType.STATUS_CHANGE]: 'text-yellow-500',
  [NotificationType.ASSIGNMENT]: 'text-green-500',
  [NotificationType.SYSTEM]: 'text-purple-500',
}

export function NotificationsDropdown() {
  const router = useRouter()
  const { user } = useAuth()
  const isMounted = useIsMounted()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isOpen, setIsOpen] = useState(false)

  const { execute: fetchNotifications, loading: fetchLoading } = useApi<{
    data: Notification[]
    unreadCount: number
  }>()
  const { execute: markAsRead, loading: markLoading } = useApi()
  const { execute: deleteNotification, loading: deleteLoading } = useApi()

  // Загрузка уведомлений
  const loadNotifications = async () => {
    const result = await fetchNotifications('/api/notifications?limit=10')
    if (result) {
      setNotifications(result.data)
      setUnreadCount(result.unreadCount)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadNotifications()
    }
  }, [isOpen])

  // Отмечаем уведомление как прочитанное
  const handleMarkAsRead = async (notificationId: string) => {
    const result = await markAsRead('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'mark_read',
        notificationIds: [notificationId],
      }),
    })

    if (result) {
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, isRead: true } : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }

  // Отмечаем все как прочитанные
  const handleMarkAllAsRead = async () => {
    const result = await markAsRead('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'mark_all_read',
      }),
    })

    if (result) {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))
      setUnreadCount(0)
    }
  }

  // Удаляем уведомление
  const handleDelete = async (notificationId: string) => {
    const result = await deleteNotification('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'delete',
        notificationIds: [notificationId],
      }),
    })

    if (result) {
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      // Обновляем счетчик непрочитанных
      loadNotifications()
    }
  }

  // Переход по уведомлению
  const handleNotificationClick = (notification: Notification) => {
    // Отмечаем как прочитанное
    if (!notification.isRead) {
      handleMarkAsRead(notification.id)
    }

    // Переходим по ссылке если есть
    if (notification.payload?.requestId) {
      router.push(`/dashboard/requests/${notification.payload.requestId}`)
    }

    setIsOpen(false)
  }

  const formatTime = (dateString: string) => {
    // Не форматируем время до монтирования компонента
    if (!isMounted) return ''

    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'только что'
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours} ч назад`

    return format(date, 'dd.MM HH:mm', { locale: ru })
  }

  if (!user) return null

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between p-4">
          <div>
            <h4 className="font-medium">Уведомления</h4>
            {unreadCount > 0 && (
              <p className="text-sm text-muted-foreground">
                {unreadCount} непрочитанных
              </p>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markLoading}
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}
        </DropdownMenuLabel>

        <Separator />

        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Нет уведомлений</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification) => {
                const IconComponent = notificationIcons[notification.type]
                const iconColor = notificationColors[notification.type]

                return (
                  <div
                    key={notification.id}
                    className={`p-3 mb-2 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      !notification.isRead ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800' : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-1 rounded-full bg-muted ${iconColor}`}>
                        <IconComponent className="h-3 w-3" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </p>

                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-muted-foreground">
                            {formatTime(notification.createdAt)}
                          </p>

                          <div className="flex items-center space-x-1">
                            {!notification.isRead && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleMarkAsRead(notification.id)
                                }}
                                disabled={markLoading}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDelete(notification.id)
                              }}
                              disabled={deleteLoading}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <>
            <Separator />
            <div className="p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  router.push('/dashboard/notifications')
                  setIsOpen(false)
                }}
              >
                Посмотреть все уведомления
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
