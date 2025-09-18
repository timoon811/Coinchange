"use client"

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Tag,
  TrendingUp,
  FileText,
  MessageSquare,
  Edit,
  Save,
  X,
  Star,
  Shield,
  ShieldOff,
  Calendar,
  DollarSign,
  Target,
  RefreshCw,
  Eye,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RequestStatus, OperationDirection, UserRole } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'

// Типы данных
interface ClientData {
  id: string
  telegramUserId: string
  username: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  languageCode: string | null
  tags: string[] | null
  notes: string | null
  totalRequests: number
  totalVolume: number | null
  isBlocked: boolean
  createdAt: string
  updatedAt: string
  requestsCount: number
  stats: {
    totalVolume: number
    avgVolume: number
    conversionRate: number
    daysSinceLastRequest: number | null
    statusBreakdown: Array<{
      status: RequestStatus
      count: number
    }>
  }
  requests: {
    data: Array<{
      id: string
      requestId: string
      status: RequestStatus
      direction: OperationDirection
      createdAt: string
      completedAt: string | null
      office: {
        name: string
        city: string
      } | null
      assignedUser: {
        firstName: string
        lastName: string | null
        username: string
      } | null
      finance: {
        fromCurrency: string
        toCurrency: string
        expectedAmountFrom: number
        expectedAmountTo: number | null
        commissionPercent: number | null
      } | null
      commentsCount: number
      attachmentsCount: number
    }>
    pagination: {
      page: number
      limit: number
      total: number
      pages: number
    }
  }
  recentComments: Array<{
    id: string
    text: string
    isInternal: boolean
    createdAt: string
    requestId: string
    author: {
      firstName: string
      lastName: string | null
      username: string
    }
  }>
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

interface ClientPageInnerProps {
  clientId: string
}

function ClientPageInner({ clientId }: ClientPageInnerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [client, setClient] = useState<ClientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Форма редактирования
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    tags: [] as string[],
    notes: '',
    isBlocked: false,
  })

  const { execute: fetchClient, loading: fetchLoading } = useApi<ClientData>()
  const { execute: updateClient, loading: updateLoading } = useApi<ClientData>()

  // Загрузка данных клиента
  const loadClient = async () => {
    const result = await fetchClient(`/api/clients/${clientId}`)
    if (result) {
      setClient(result)
      setEditForm({
        firstName: result.firstName || '',
        lastName: result.lastName || '',
        phone: result.phone || '',
        tags: result.tags || [],
        notes: result.notes || '',
        isBlocked: result.isBlocked,
      })
    } else {
      router.push('/dashboard/clients')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadClient()
  }, [clientId])

  // Автоматически включаем режим редактирования если есть параметр edit=true
  useEffect(() => {
    const editParam = searchParams.get('edit')
    if (editParam === 'true' && user?.role === UserRole.ADMIN) {
      setEditing(true)
    }
  }, [searchParams, user])

  // Сохранение изменений
  const handleSave = async () => {
    if (!client) return

    setSaving(true)
    const result = await updateClient(`/api/clients/${clientId}`, {
      method: 'PATCH',
      body: JSON.stringify(editForm),
    })

    if (result) {
      setClient(result)
      setEditing(false)
    }
    setSaving(false)
  }

  // Отмена редактирования
  const handleCancel = () => {
    if (!client) return

    setEditForm({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      phone: client.phone || '',
      tags: client.tags || [],
      notes: client.notes || '',
      isBlocked: client.isBlocked,
    })
    setEditing(false)
  }

  const formatVolume = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toLocaleString()
  }

  const getClientInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || 'U'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка клиента...</p>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <User className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Клиент не найден</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {client.firstName || client.lastName
                ? `${client.firstName || ''} ${client.lastName || ''}`.trim()
                : client.username || `ID: ${client.telegramUserId}`
              }
            </h1>
            <p className="text-muted-foreground">
              {client.username && `Telegram: @${client.username}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {user?.role === UserRole.ADMIN && (
            editing ? (
              <>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Отмена
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Редактировать
              </Button>
            )
          )}
          <Badge variant={client.isBlocked ? "destructive" : "secondary"}>
            {client.isBlocked ? (
              <>
                <ShieldOff className="h-3 w-3 mr-1" />
                Заблокирован
              </>
            ) : (
              <>
                <Shield className="h-3 w-3 mr-1" />
                Активен
              </>
            )}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Основная информация */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Информация о клиенте
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">
                  {getClientInitials(client.firstName, client.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Имя</Label>
                    {editing ? (
                      <Input
                        value={editForm.firstName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Имя"
                      />
                    ) : (
                      <p className="font-medium">{client.firstName || 'Не указано'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Фамилия</Label>
                    {editing ? (
                      <Input
                        value={editForm.lastName}
                        onChange={(e) => setEditForm(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Фамилия"
                      />
                    ) : (
                      <p className="font-medium">{client.lastName || 'Не указано'}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Телефон</Label>
                    {editing ? (
                      <Input
                        value={editForm.phone}
                        onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="Телефон"
                      />
                    ) : (
                      <p className="font-medium">{client.phone || 'Не указан'}</p>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Telegram ID</Label>
                    <p className="font-medium">{client.telegramUserId}</p>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Метки */}
            <div>
              <Label className="text-sm text-muted-foreground">Метки</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {editing ? (
                  <div className="w-full">
                    <Input
                      value={editForm.tags.join(', ')}
                      onChange={(e) => setEditForm(prev => ({
                        ...prev,
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                      }))}
                      placeholder="Метки через запятую (VIP, regular, etc.)"
                    />
                  </div>
                ) : (
                  client.tags?.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag === 'VIP' && <Star className="h-3 w-3 mr-1" />}
                      {tag}
                    </Badge>
                  )) || []
                )}
                {!editing && (!client.tags || client.tags.length === 0) && (
                  <span className="text-muted-foreground">Нет меток</span>
                )}
              </div>
            </div>

            {/* Заметки */}
            <div>
              <Label className="text-sm text-muted-foreground">Заметки</Label>
              {editing ? (
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Внутренние заметки о клиенте"
                  className="mt-2"
                />
              ) : (
                <p className="text-sm mt-2">{client.notes || 'Нет заметок'}</p>
              )}
            </div>

            {/* Блокировка (только в режиме редактирования) */}
            {editing && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBlocked"
                  checked={editForm.isBlocked}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, isBlocked: checked as boolean }))}
                />
                <Label htmlFor="isBlocked" className="flex items-center cursor-pointer">
                  <Shield className="h-4 w-4 mr-2" />
                  Заблокировать клиента
                </Label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Статистика */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              Статистика
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Всего заявок</p>
                <p className="text-2xl font-bold">{client.totalRequests}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Конверсия</p>
                <p className="text-2xl font-bold">{client.stats.conversionRate}%</p>
              </div>
            </div>

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground">Общий объем</p>
              <p className="text-xl font-bold">{formatVolume(client.stats.totalVolume)}</p>
            </div>

            <div>
              <p className="text-sm text-muted-foreground">Средний чек</p>
              <p className="text-xl font-bold">{formatVolume(client.stats.avgVolume)}</p>
            </div>

            {client.stats.daysSinceLastRequest !== null && (
              <div>
                <p className="text-sm text-muted-foreground">Дней с последней заявки</p>
                <p className="text-xl font-bold">{client.stats.daysSinceLastRequest}</p>
              </div>
            )}

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-2">По статусам</p>
              <div className="space-y-2">
                {client.stats.statusBreakdown.map((stat) => {
                  const statusInfo = statusConfig[stat.status]
                  return (
                    <div key={stat.status} className="flex items-center justify-between">
                      <Badge variant="secondary" className={`${statusInfo.color} text-white text-xs`}>
                        {statusInfo.label}
                      </Badge>
                      <span className="text-sm font-medium">{stat.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* История заявок */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            История заявок ({client.requestsCount || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {client.requests.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Направление</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Офис</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>Дата</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.requests.data.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      {request.requestId}
                    </TableCell>
                    <TableCell>
                      {directionLabels[request.direction]}
                    </TableCell>
                    <TableCell>
                      {request.finance && `${formatVolume(request.finance.expectedAmountFrom)} ${request.finance.fromCurrency}`}
                    </TableCell>
                    <TableCell>
                      {request.office ? `${request.office.name}, ${request.office.city}` : 'Не указан'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`${statusConfig[request.status].color} text-white`}
                      >
                        {statusConfig[request.status].label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {format(new Date(request.createdAt), 'dd.MM.yyyy', { locale: ru })}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/dashboard/requests/${request.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              У клиента нет заявок
            </div>
          )}
        </CardContent>
      </Card>

      {/* Недавние комментарии */}
      {client.recentComments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="h-5 w-5 mr-2" />
              Недавние комментарии
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {client.recentComments.map((comment) => (
                <div key={comment.id} className="flex space-x-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {comment.author.firstName?.charAt(0)}
                      {comment.author.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium">
                        {comment.author.firstName} {comment.author.lastName}
                      </p>
                      {comment.isInternal && (
                        <Badge variant="secondary" className="text-xs">
                          Внутренний
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(comment.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        Заявка {comment.requestId}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  return <ClientPageWrapper params={params} />
}

function ClientPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  const [clientId, setClientId] = useState<string | null>(null)

  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params
      setClientId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  if (!clientId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка...</p>
        </div>
      </div>
    )
  }

  return <ClientPageInner clientId={clientId} />
}
