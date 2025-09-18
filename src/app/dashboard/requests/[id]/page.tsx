"use client"

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  ArrowLeft,
  Clock,
  User,
  CreditCard,
  FileText,
  MessageSquare,
  History,
  Edit,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Download,
  Copy,
  Eye,
  EyeOff,
  Plus,
  Send,
  MoreHorizontal,
} from 'lucide-react'
import { Stepper } from '@/components/ui/stepper'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { RequestStatus, OperationDirection, NetworkType } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import { UserRole } from '@prisma/client'
import { toast } from 'sonner'

// Типы данных
interface RequestData {
  id: string
  requestId: string
  client: {
    id: string
    telegramUserId: string
    username: string | null
    firstName: string | null
    lastName: string | null
    phone: string | null
    tags: string[] | null
    notes: string | null
    totalRequests: number
    totalVolume: number | null
  }
  office: {
    id: string
    name: string
    city: string
    address: string
    phone: string | null
  } | null
  assignedUser: {
    id: string
    firstName: string
    lastName: string | null
    username: string
  } | null
  direction: OperationDirection
  status: RequestStatus
  source: string
  locale: string
  createdAt: string
  updatedAt: string
  completedAt: string | null
  slaDeadline: string | null
  isOverdue: boolean
  timeToSLA: number | null
  finance: {
    fromCurrency: string
    fromNetwork: NetworkType | null
    toCurrency: string
    expectedAmountFrom: number
    expectedAmountTo: number | null
    actualAmountFrom: number | null
    actualAmountTo: number | null
    rateValue: number | null
    commissionPercent: number | null
    commissionFixed: number | null
  } | null
  requisites: {
    walletAddress: string | null
    cardNumber: string | null
    cardMasked: string | null
    bankName: string | null
  } | null
  attachments?: Array<{
    id: string
    filename: string
    originalName: string
    fileUrl: string
    fileSize: number
    mimeType: string
    type: string
    uploadedBy: string
    createdAt: string
  }>
  comments?: Array<{
    id: string
    text: string
    isInternal: boolean
    createdAt: string
    author: {
      firstName: string
      lastName: string | null
      username: string
    }
  }>
  statusHistory?: Array<{
    id: string
    action: string
    oldValues?: Record<string, unknown>
    newValues?: Record<string, unknown>
    createdAt: string
    actor: {
      firstName: string
      lastName: string | null
      username: string
    }
  }>
}

const statusSteps = [
  { status: RequestStatus.NEW, label: 'Новая', description: 'Заявка создана' },
  { status: RequestStatus.ASSIGNED, label: 'Назначена', description: 'Кассир/офис назначен' },
  { status: RequestStatus.AWAITING_CLIENT, label: 'Ожидает клиента', description: 'Необходимо действие клиента' },
  { status: RequestStatus.IN_PROGRESS, label: 'В работе', description: 'Активная обработка' },
  { status: RequestStatus.AWAITING_CONFIRMATION, label: 'Ожидает подтверждения', description: 'Проверка документов' },
  { status: RequestStatus.COMPLETED, label: 'Завершена', description: 'Заявка выполнена' },
]

const allStatusLabels = {
  [RequestStatus.NEW]: 'Новая',
  [RequestStatus.ASSIGNED]: 'Назначена', 
  [RequestStatus.AWAITING_CLIENT]: 'Ожидает клиента',
  [RequestStatus.IN_PROGRESS]: 'В работе',
  [RequestStatus.AWAITING_CONFIRMATION]: 'Ожидает подтверждения',
  [RequestStatus.COMPLETED]: 'Завершена',
  [RequestStatus.CANCELED]: 'Отменена',
  [RequestStatus.REJECTED]: 'Отклонена',
}

const directionLabels = {
  [OperationDirection.CRYPTO_TO_CASH]: 'Крипта → Наличные',
  [OperationDirection.CASH_TO_CRYPTO]: 'Наличные → Крипта',
  [OperationDirection.CARD_TO_CRYPTO]: 'Карта → Крипта',
  [OperationDirection.CRYPTO_TO_CARD]: 'Крипта → Карта',
  [OperationDirection.CARD_TO_CASH]: 'Карта → Наличные',
  [OperationDirection.CASH_TO_CARD]: 'Наличные → Карта',
}

const networkLabels = {
  [NetworkType.ETH]: 'Ethereum',
  [NetworkType.TRON]: 'Tron',
  [NetworkType.BSC]: 'BSC',
  [NetworkType.TON]: 'TON',
  [NetworkType.SOL]: 'Solana',
  [NetworkType.BTC]: 'Bitcoin',
  [NetworkType.POLYGON]: 'Polygon',
  [NetworkType.AVALANCHE]: 'Avalanche',
}

export default function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const [request, setRequest] = useState<RequestData | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [showWallet, setShowWallet] = useState(false)
  const [showCard, setShowCard] = useState(false)

  const { execute: fetchRequest, loading: fetchLoading } = useApi<RequestData>()
  const { execute: updateRequest, loading: updateLoading } = useApi<RequestData>()
  const { execute: addComment, loading: commentLoading } = useApi()

  // Загрузка данных заявки
  const loadRequest = async () => {
    const result = await fetchRequest(`/api/requests/${resolvedParams.id}`, {
      showErrorToast: true
    })
    if (result) {
      setRequest(result)
    } else {
      router.push('/dashboard/requests')
    }
    setLoading(false)
  }

  useEffect(() => {
    loadRequest()
  }, [resolvedParams.id])

  // Обновление статуса заявки
  const handleStatusChange = async (newStatus: RequestStatus) => {
    if (!request) return

    setUpdating(true)
    const result = await updateRequest(`/api/requests/${resolvedParams.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
      showSuccessToast: true,
      successMessage: `Статус заявки изменен на "${statusSteps.find(s => s.status === newStatus)?.label}"`
    })

    if (result) {
      setRequest(result)
    }
    setUpdating(false)
  }

  // Добавление комментария
  const handleAddComment = async () => {
    if (!request || !newComment.trim()) return

    const result = await addComment(`/api/requests/${resolvedParams.id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ text: newComment }),
      showSuccessToast: true,
      successMessage: 'Комментарий добавлен'
    })

    if (result) {
      setNewComment('')
      loadRequest() // Перезагрузка данных
    }
  }

  // Копирование в буфер обмена
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Скопировано в буфер обмена')
    } catch (error) {
      toast.error('Ошибка копирования')
    }
  }

  const getCurrentStepIndex = () => {
    if (!request) return 0
    
    // Для отмененных и отклоненных заявок показываем последний достигнутый этап
    if (request.status === RequestStatus.CANCELED || request.status === RequestStatus.REJECTED) {
      // Возвращаем -1 чтобы показать, что заявка не в основном потоке
      return -1
    }
    
    return statusSteps.findIndex(step => step.status === request.status)
  }

  const getStepStatus = (stepIndex: number) => {
    const currentIndex = getCurrentStepIndex()
    if (stepIndex < currentIndex) return 'completed'
    if (stepIndex === currentIndex) return 'current'
    return 'pending'
  }

  const isRequestTerminated = () => {
    return request?.status === RequestStatus.CANCELED || request?.status === RequestStatus.REJECTED
  }

  // Логика валидации переходов статусов
  const getValidStatusTransitions = (currentStatus: RequestStatus): RequestStatus[] => {
    const transitions: Record<RequestStatus, RequestStatus[]> = {
      [RequestStatus.NEW]: [
        RequestStatus.ASSIGNED,
        RequestStatus.AWAITING_CLIENT,
        RequestStatus.CANCELED,
        RequestStatus.REJECTED
      ],
      [RequestStatus.ASSIGNED]: [
        RequestStatus.AWAITING_CLIENT,
        RequestStatus.IN_PROGRESS,
        RequestStatus.CANCELED,
        RequestStatus.REJECTED
      ],
      [RequestStatus.AWAITING_CLIENT]: [
        RequestStatus.IN_PROGRESS,
        RequestStatus.CANCELED,
        RequestStatus.REJECTED
      ],
      [RequestStatus.IN_PROGRESS]: [
        RequestStatus.AWAITING_CONFIRMATION,
        RequestStatus.AWAITING_CLIENT,
        RequestStatus.COMPLETED,
        RequestStatus.CANCELED,
        RequestStatus.REJECTED
      ],
      [RequestStatus.AWAITING_CONFIRMATION]: [
        RequestStatus.COMPLETED,
        RequestStatus.IN_PROGRESS,
        RequestStatus.CANCELED,
        RequestStatus.REJECTED
      ],
      [RequestStatus.COMPLETED]: [], // Финальный статус
      [RequestStatus.CANCELED]: [], // Финальный статус
      [RequestStatus.REJECTED]: [], // Финальный статус
    }

    return transitions[currentStatus] || []
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка заявки...</p>
        </div>
      </div>
    )
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-red-500" />
          <p className="text-muted-foreground">Заявка не найдена</p>
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
            <h1 className="text-2xl font-bold">Заявка {request.requestId}</h1>
            <p className="text-muted-foreground">
              {directionLabels[request.direction]} • {request.client?.firstName || ''} {request.client?.lastName || ''}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-sm">
            {request.source === 'telegram' ? 'Telegram' : 'Ручная'}
          </Badge>
          <Badge
            variant="secondary"
            className={`${
              request.status === RequestStatus.COMPLETED
                ? 'bg-green-500'
                : request.status === RequestStatus.CANCELED 
                ? 'bg-gray-500'
                : request.status === RequestStatus.REJECTED
                ? 'bg-red-500'
                : request.isOverdue
                ? 'bg-orange-500'
                : 'bg-blue-500'
            } text-white`}
          >
            {request.isOverdue && <AlertTriangle className="h-3 w-3 mr-1" />}
            {request.status === RequestStatus.CANCELED && <XCircle className="h-3 w-3 mr-1" />}
            {request.status === RequestStatus.REJECTED && <AlertTriangle className="h-3 w-3 mr-1" />}
            {allStatusLabels[request.status]}
          </Badge>
        </div>
      </div>

      {/* Stepper жизненного цикла */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <div className={`h-5 w-5 rounded-full flex items-center justify-center ${
              isRequestTerminated() 
                ? 'bg-red-500/10' 
                : 'bg-blue-500/10'
            }`}>
              {isRequestTerminated() ? (
                <XCircle className="h-3 w-3 text-red-500" />
              ) : (
                <Clock className="h-3 w-3 text-blue-500" />
              )}
            </div>
            Жизненный цикл заявки
          </CardTitle>
          <CardDescription className="text-base">
            {isRequestTerminated() ? (
              <span className="font-medium text-red-600">
                Заявка {request.status === RequestStatus.CANCELED ? 'отменена' : 'отклонена'}
              </span>
            ) : (
              <>
                Текущий этап: <span className="font-medium text-foreground">
                  {statusSteps[getCurrentStepIndex()]?.description || 'Неизвестный этап'}
                </span>
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2 pb-8">
          {isRequestTerminated() ? (
            <div className="py-6">
              <div className="text-center space-y-4">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full ${
                  request.status === RequestStatus.CANCELED ? 'bg-gray-100' : 'bg-red-100'
                }`}>
                  {request.status === RequestStatus.CANCELED ? (
                    <XCircle className="h-8 w-8 text-gray-500" />
                  ) : (
                    <AlertTriangle className="h-8 w-8 text-red-500" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-foreground">
                    {allStatusLabels[request.status]}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {request.status === RequestStatus.CANCELED 
                      ? 'Заявка была отменена и больше не обрабатывается'
                      : 'Заявка была отклонена и не может быть выполнена'
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(request.updatedAt), 'dd MMMM yyyy в HH:mm', { locale: ru })}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-4">
              <Stepper
                steps={statusSteps.map(step => ({
                  title: step.label,
                  description: step.description,
                }))}
                currentStep={getCurrentStepIndex()}
                completedSteps={statusSteps
                  .map((_, index) => index)
                  .filter(index => index < getCurrentStepIndex())
                }
                className="px-2"
              />
            </div>
          )}

          {/* SLA информация */}
          {request.slaDeadline && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {request.isOverdue ? 'SLA просрочен' : 'До завершения SLA'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(request.slaDeadline), 'dd.MM.yyyy HH:mm', { locale: ru })}
                  </p>
                </div>
              </div>
              {request.timeToSLA && request.timeToSLA > 0 && (
                <Badge variant={request.isOverdue ? "destructive" : "secondary"}>
                  {request.isOverdue ? 'Просрочено' : `${Math.floor(request.timeToSLA / (1000 * 60 * 60))}ч ${Math.floor((request.timeToSLA % (1000 * 60 * 60)) / (1000 * 60))}м`}
                </Badge>
              )}
            </div>
          )}

          {/* Управление статусом */}
          {user?.role === UserRole.ADMIN && !isRequestTerminated() && (
            <div className="flex items-center justify-between pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Изменить статус:
              </div>
              <Select
                value={request.status}
                onValueChange={handleStatusChange}
                disabled={updating || updateLoading}
              >
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* Текущий статус всегда показываем */}
                  <SelectItem value={request.status} disabled>
                    {allStatusLabels[request.status]} (текущий)
                  </SelectItem>
                  
                  {/* Валидные переходы */}
                  {getValidStatusTransitions(request.status).map((status) => (
                    <SelectItem key={status} value={status}>
                      {allStatusLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Информация для завершенных заявок */}
          {isRequestTerminated() && (
            <div className="pt-4 border-t">
              <div className="flex items-center justify-center p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">
                  Заявка {request.status === RequestStatus.CANCELED ? 'отменена' : 'отклонена'} и не может быть изменена
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Информация о клиенте */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="h-5 w-5 mr-2" />
              Информация о клиенте
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback>
                  {request.client?.firstName?.charAt(0)}
                  {request.client?.lastName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">
                  {request.client?.firstName || ''} {request.client?.lastName || ''}
                </p>
                {request.client?.username && (
                  <p className="text-sm text-muted-foreground">
                    @{request.client.username}
                  </p>
                )}
                {request.client?.phone && (
                  <p className="text-sm text-muted-foreground">
                    {request.client.phone}
                  </p>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Всего заявок</p>
                <p className="font-medium">{request.client?.totalRequests || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Общий объем</p>
                <p className="font-medium">
                  {request.client?.totalVolume ? `${request.client.totalVolume.toLocaleString()} USDT` : '0'}
                </p>
              </div>
            </div>

            {request.client?.tags && request.client.tags.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Метки:</p>
                <div className="flex flex-wrap gap-2">
                  {request.client.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {request.client?.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Заметки:</p>
                <p className="text-sm">{request.client.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Финансовая информация */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <CreditCard className="h-5 w-5 mr-2" />
              Финансовая информация
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Отдаёт</p>
                <p className="font-medium">
                  {request.finance?.expectedAmountFrom.toLocaleString()} {request.finance?.fromCurrency}
                </p>
                {request.finance?.fromNetwork && (
                  <p className="text-xs text-muted-foreground">
                    {networkLabels[request.finance.fromNetwork]}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Получает</p>
                <p className="font-medium">
                  {request.finance?.expectedAmountTo?.toLocaleString()} {request.finance?.toCurrency}
                </p>
              </div>
            </div>

            {request.finance?.rateValue && (
              <div>
                <p className="text-sm text-muted-foreground">Курс</p>
                <p className="font-medium">{request.finance?.rateValue}</p>
              </div>
            )}

            {(request.finance?.commissionPercent || request.finance?.commissionFixed) && (
              <div>
                <p className="text-sm text-muted-foreground">Комиссия</p>
                <p className="font-medium">
                  {request.finance?.commissionPercent
                    ? `${request.finance.commissionPercent}%`
                    : `${request.finance?.commissionFixed} ${request.finance?.fromCurrency}`
                  }
                </p>
              </div>
            )}

            {request.finance?.actualAmountFrom && request.finance?.actualAmountTo && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Фактически отдано</p>
                    <p className="font-medium">
                      {request.finance?.actualAmountFrom?.toLocaleString()} {request.finance?.fromCurrency}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Фактически получено</p>
                    <p className="font-medium">
                      {request.finance?.actualAmountTo?.toLocaleString()} {request.finance?.toCurrency}
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Реквизиты */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Реквизиты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {request.requisites?.walletAddress && (
              <div>
                <Label className="text-sm text-muted-foreground">Кошелёк</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                    {showWallet
                      ? request.requisites?.walletAddress
                      : `${request.requisites?.walletAddress?.slice(0, 8)}...${request.requisites?.walletAddress?.slice(-8)}`
                    }
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowWallet(!showWallet)}
                  >
                    {showWallet ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(request.requisites?.walletAddress || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {request.requisites?.cardMasked && (
              <div>
                <Label className="text-sm text-muted-foreground">Карта</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="flex-1 p-2 bg-muted rounded text-sm font-mono">
                    {showCard && request.requisites?.cardNumber
                      ? request.requisites.cardNumber
                      : request.requisites?.cardMasked
                    }
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCard(!showCard)}
                  >
                    {showCard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(request.requisites?.cardMasked || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                {request.requisites?.bankName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {request.requisites.bankName}
                  </p>
                )}
              </div>
            )}

            {request.office && (
              <div>
                <Label className="text-sm text-muted-foreground">Офис</Label>
                <p className="text-sm mt-1">
                  {request.office.name}, {request.office.city}
                </p>
                <p className="text-xs text-muted-foreground">
                  {request.office.address}
                </p>
                {request.office.phone && (
                  <p className="text-xs text-muted-foreground">
                    {request.office.phone}
                  </p>
                )}
              </div>
            )}

            {request.assignedUser && (
              <div>
                <Label className="text-sm text-muted-foreground">Ответственный</Label>
                <p className="text-sm mt-1">
                  {request.assignedUser.firstName} {request.assignedUser.lastName}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Вложения */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Download className="h-5 w-5 mr-2" />
              Вложения ({request.attachments?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {request.attachments && request.attachments.length > 0 ? (
              <div className="space-y-2">
                {request.attachments.map((attachment) => (
                  <div key={attachment.id} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{attachment.originalName}</p>
                        <p className="text-xs text-muted-foreground">
                          {(attachment.fileSize / 1024).toFixed(1)} KB • {attachment.type}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Вложений нет</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Комментарии */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Комментарии ({request.comments?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Добавление комментария */}
          <div className="space-y-2">
            <Label htmlFor="comment">Добавить комментарий</Label>
            <div className="flex space-x-2">
              <Textarea
                id="comment"
                placeholder="Введите комментарий..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1"
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || commentLoading}
                size="sm"
              >
                {commentLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* Список комментариев */}
          <div className="space-y-4">
            {request.comments?.map((comment) => (
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
                  </div>
                  <p className="text-sm mt-1">{comment.text}</p>
                </div>
              </div>
            ))}

            {(!request.comments || request.comments.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Комментариев нет
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* История изменений */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <History className="h-5 w-5 mr-2" />
            История изменений ({request.statusHistory?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {request.statusHistory?.map((history) => (
              <div key={history.id} className="flex items-start space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium">
                      {history.actor.firstName} {history.actor.lastName}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(history.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {history.action === 'status_change'
                      ? `Изменен статус: ${history.oldValues?.status || 'Новый'} → ${history.newValues?.status}`
                      : history.action
                    }
                  </p>
                </div>
              </div>
            ))}

            {(!request.statusHistory || request.statusHistory.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                История изменений пуста
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
