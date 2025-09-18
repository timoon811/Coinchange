"use client"

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  AlertTriangle,
  Clock,
  RefreshCw,
  Send,
  Plus,
  Eye,
  User,
  Building2,
  Timer,
  CheckCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { RequestStatus, OperationDirection, UserRole } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import type { SLAStatus } from '@/lib/types'

// Типы данных
interface SLARequest {
  id: string
  requestId: string
  client: {
    firstName: string | null
    lastName: string | null
  }
  office: {
    name: string
    city: string
  } | null
  assignedUser: {
    firstName: string
    lastName: string | null
    username: string
  } | null
  status: RequestStatus
  direction: OperationDirection
  finance: {
    fromCurrency: string
    expectedAmountFrom: number
  } | null
  slaDeadline: string
  isOverdue: boolean
  timeToSLA: number | null
  createdAt: string
}

const statusConfig = {
  [RequestStatus.NEW]: { label: 'Новая', color: 'bg-blue-500' },
  [RequestStatus.ASSIGNED]: { label: 'Назначена', color: 'bg-yellow-500' },
  [RequestStatus.AWAITING_CLIENT]: { label: 'Ожидает клиента', color: 'bg-orange-500' },
  [RequestStatus.IN_PROGRESS]: { label: 'В работе', color: 'bg-purple-500' },
  [RequestStatus.AWAITING_CONFIRMATION]: { label: 'Ожидает подтверждения', color: 'bg-cyan-500' },
  [RequestStatus.COMPLETED]: { label: 'Завершена', color: 'bg-green-500' },
  [RequestStatus.CANCELED]: { label: 'Отменена', color: 'bg-gray-500' },
  [RequestStatus.REJECTED]: { label: 'Отклонена', color: 'bg-red-500' },
}

const directionLabels = {
  [OperationDirection.CRYPTO_TO_CASH]: 'Крипта → Наличные',
  [OperationDirection.CASH_TO_CRYPTO]: 'Наличные → Крипта',
  [OperationDirection.CARD_TO_CRYPTO]: 'Карта → Крипта',
  [OperationDirection.CRYPTO_TO_CARD]: 'Крипта → Карта',
  [OperationDirection.CARD_TO_CASH]: 'Карта → Наличные',
  [OperationDirection.CASH_TO_CARD]: 'Наличные → Карта',
}

export default function SLAPage() {
  const { user } = useAuth()
  const [slaRequests, setSlaRequests] = useState<SLARequest[]>([])
  const [loading, setLoading] = useState(true)
  const [type, setType] = useState<'overdue' | 'upcoming'>('overdue')
  const [selectedRequest, setSelectedRequest] = useState<SLARequest | null>(null)
  const [actionDialogOpen, setActionDialogOpen] = useState(false)

  const { execute: fetchSLARequests, loading: fetchLoading } = useApi<{ success: boolean; data: SLARequest[] }>()
  const { execute: performAction, loading: actionLoading } = useApi()

  // Загрузка SLA заявок
  const loadSLARequests = async (requestType: 'overdue' | 'upcoming' = type) => {
    setLoading(true)
    try {
      const result = await fetchSLARequests(`/api/sla?type=${requestType}`)
      if (result && result.success && Array.isArray(result.data)) {
        setSlaRequests(result.data)
      } else {
        setSlaRequests([])
      }
    } catch (error) {
      console.error('Failed to load SLA requests:', error)
      setSlaRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSLARequests()
  }, [])

  const handleTypeChange = (newType: 'overdue' | 'upcoming') => {
    setType(newType)
    loadSLARequests(newType)
  }

  const handleAction = async (action: 'extend_sla' | 'send_reminder') => {
    if (!selectedRequest) return

    const result = await performAction('/api/sla', {
      method: 'POST',
      body: JSON.stringify({
        action,
        requestId: selectedRequest.id,
      }),
    })

    if (result) {
      setActionDialogOpen(false)
      setSelectedRequest(null)
      loadSLARequests()
    }
  }

  const formatTimeToSLA = (timeToSLA: number | null, isOverdue: boolean) => {
    if (!timeToSLA && !isOverdue) return '-'

    if (isOverdue) {
      return 'Просрочено'
    }

    if (timeToSLA === null) {
      return 'Нет дедлайна'
    }

    const hours = Math.floor(timeToSLA / 60)
    const minutes = timeToSLA % 60

    if (hours > 0) {
      return `${hours}ч ${minutes}м`
    }

    return `${minutes}м`
  }

  const getSLAStatusColor = (isOverdue: boolean, timeToSLA: number | null) => {
    if (isOverdue) return 'text-red-600 bg-red-50 dark:bg-red-950/20'
    if (timeToSLA && timeToSLA <= 30) return 'text-orange-600 bg-orange-50 dark:bg-orange-950/20'
    return 'text-green-600 bg-green-50 dark:bg-green-950/20'
  }

  // Проверяем права доступа
  if (!user || user.role !== UserRole.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Недостаточно прав</h2>
          <p className="text-muted-foreground">
            У вас нет прав доступа к SLA мониторингу
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-6 max-w-full">
      {/* Заголовок */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">SLA Мониторинг</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Отслеживание просроченных заявок и дедлайнов
          </p>
        </div>
        <Button onClick={() => loadSLARequests()} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {/* Выбор типа SLA */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
            <div className="text-sm font-medium">Показать:</div>
            <Select value={type} onValueChange={(value: string) => handleTypeChange(value as SLAStatus)}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="overdue">
                  <div className="flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
                    Просроченные заявки
                  </div>
                </SelectItem>
                <SelectItem value="upcoming">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-orange-500" />
                    Приближающиеся дедлайны
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Badge variant="outline" className="sm:ml-auto">
              Всего: {Array.isArray(slaRequests) ? slaRequests.length : 0}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Статистика SLA */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Просрочено</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {Array.isArray(slaRequests) ? slaRequests.filter(r => r.isOverdue).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Требуют срочного внимания
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Менее 30 мин</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {Array.isArray(slaRequests) ? slaRequests.filter(r => !r.isOverdue && r.timeToSLA && r.timeToSLA <= 30).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Критические дедлайны
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">В работе</CardTitle>
            <Timer className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {Array.isArray(slaRequests) ? slaRequests.filter(r => !r.isOverdue && r.timeToSLA && r.timeToSLA > 30).length : 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Имеют время на обработку
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Предупреждение для просроченных */}
      {type === 'overdue' && Array.isArray(slaRequests) && slaRequests.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Обнаружено {slaRequests.filter(r => r.isOverdue).length} просроченных заявок.
            Необходимо срочно принять меры для их обработки.
          </AlertDescription>
        </Alert>
      )}

      {/* Таблица SLA заявок */}
      <Card>
        <CardHeader>
          <CardTitle>
            {type === 'overdue' ? 'Просроченные заявки' : 'Приближающиеся дедлайны'}
          </CardTitle>
          <CardDescription>
            {type === 'overdue'
              ? 'Заявки, у которых истек срок SLA'
              : 'Заявки с приближающимся дедлайном (следующие 60 минут)'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto" />
            </div>
          ) : (!Array.isArray(slaRequests) || slaRequests.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <h3 className="text-lg font-medium mb-2">Все в порядке!</h3>
              <p>
                {type === 'overdue'
                  ? 'Нет просроченных заявок'
                  : 'Нет заявок с приближающимися дедлайнами'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Таблица для больших экранов */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Заявка</TableHead>
                      <TableHead className="w-[140px]">Клиент</TableHead>
                      <TableHead className="w-[140px]">Офис</TableHead>
                      <TableHead className="w-[140px]">Кассир</TableHead>
                      <TableHead className="w-[120px]">Сумма</TableHead>
                      <TableHead className="w-[120px]">Дедлайн</TableHead>
                      <TableHead className="w-[120px]">SLA</TableHead>
                      <TableHead className="w-[80px] text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
              <TableBody>
                {Array.isArray(slaRequests) && slaRequests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{request.requestId}</div>
                        <div className="text-sm text-muted-foreground">
                          {directionLabels[request.direction]}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {request.client.firstName} {request.client.lastName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {request.office ? (
                        <div className="flex items-center space-x-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">{request.office.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.office.city}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Не назначен</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.assignedUser ? (
                        <div>
                          <div className="font-medium">
                            {request.assignedUser.firstName} {request.assignedUser.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            @{request.assignedUser.username}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Не назначен</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {request.finance && (
                        <div>
                          <div className="font-medium">
                            {request.finance.expectedAmountFrom.toLocaleString()} {request.finance.fromCurrency}
                          </div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{format(new Date(request.slaDeadline), 'dd.MM.yyyy', { locale: ru })}</div>
                        <div className="text-muted-foreground">
                          {format(new Date(request.slaDeadline), 'HH:mm', { locale: ru })}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={getSLAStatusColor(request.isOverdue, request.timeToSLA)}
                      >
                        {request.isOverdue ? (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Просрочено
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            {formatTimeToSLA(request.timeToSLA, request.isOverdue)}
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/dashboard/requests/${request.id}`, '_blank')}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        <Dialog 
                          open={actionDialogOpen && selectedRequest?.id === request.id}
                          onOpenChange={(open) => {
                            setActionDialogOpen(open)
                            if (open) {
                              setSelectedRequest(request)
                            } else {
                              setSelectedRequest(null)
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedRequest(request)
                                setActionDialogOpen(true)
                              }}
                            >
                              Действия
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Действия с заявкой</DialogTitle>
                              <DialogDescription>
                                Выберите действие для заявки {request.requestId}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Button
                                  variant="outline"
                                  onClick={() => handleAction('extend_sla')}
                                  disabled={actionLoading}
                                  className="w-full"
                                >
                                  <Plus className="h-4 w-4 mr-2" />
                                  Продлить SLA
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => handleAction('send_reminder')}
                                  disabled={actionLoading}
                                  className="w-full"
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Отправить напоминание
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                  </TableBody>
                </Table>
              </div>

              {/* Карточки для мобильных устройств */}
              <div className="lg:hidden space-y-4">
                {Array.isArray(slaRequests) && slaRequests.map((request) => (
                  <Card key={request.id} className="p-4">
                    <div className="space-y-3">
                      {/* Заголовок карточки */}
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-lg">{request.requestId}</div>
                          <div className="text-sm text-muted-foreground">
                            {directionLabels[request.direction]}
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={getSLAStatusColor(request.isOverdue, request.timeToSLA)}
                        >
                          {request.isOverdue ? (
                            <>
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Просрочено
                            </>
                          ) : (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTimeToSLA(request.timeToSLA, request.isOverdue)}
                            </>
                          )}
                        </Badge>
                      </div>

                      {/* Информация */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="flex items-center text-muted-foreground mb-1">
                            <User className="h-3 w-3 mr-1" />
                            Клиент
                          </div>
                          <div className="font-medium">
                            {request.client.firstName} {request.client.lastName}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center text-muted-foreground mb-1">
                            <Building2 className="h-3 w-3 mr-1" />
                            Офис
                          </div>
                          <div className="font-medium">
                            {request.office ? (
                              <>
                                <div>{request.office.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {request.office.city}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Не назначен</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center text-muted-foreground mb-1">
                            <User className="h-3 w-3 mr-1" />
                            Кассир
                          </div>
                          <div className="font-medium">
                            {request.assignedUser ? (
                              <>
                                <div>
                                  {request.assignedUser.firstName} {request.assignedUser.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  @{request.assignedUser.username}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Не назначен</span>
                            )}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center text-muted-foreground mb-1">
                            <Timer className="h-3 w-3 mr-1" />
                            Дедлайн
                          </div>
                          <div className="font-medium">
                            <div>{format(new Date(request.slaDeadline), 'dd.MM.yyyy', { locale: ru })}</div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(request.slaDeadline), 'HH:mm', { locale: ru })}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Сумма и действия */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div>
                          {request.finance && (
                            <div className="font-medium">
                              {request.finance.expectedAmountFrom.toLocaleString()} {request.finance.fromCurrency}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/dashboard/requests/${request.id}`, '_blank')}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>

                          <Dialog 
                            open={actionDialogOpen && selectedRequest?.id === request.id}
                            onOpenChange={(open) => {
                              setActionDialogOpen(open)
                              if (open) {
                                setSelectedRequest(request)
                              } else {
                                setSelectedRequest(null)
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request)
                                  setActionDialogOpen(true)
                                }}
                              >
                                Действия
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Действия с заявкой</DialogTitle>
                                <DialogDescription>
                                  Выберите действие для заявки {request.requestId}
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleAction('extend_sla')}
                                    disabled={actionLoading}
                                    className="w-full"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Продлить SLA
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => handleAction('send_reminder')}
                                    disabled={actionLoading}
                                    className="w-full"
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Отправить напоминание
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
