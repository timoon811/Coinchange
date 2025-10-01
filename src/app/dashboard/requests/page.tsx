"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Search,
  Filter,
  Plus,
  Eye,
  Edit,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserCheck,
  MoreHorizontal,
  RefreshCw,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { CreateRequestModal } from '@/components/create-request-modal'
import { EditRequestModal } from '@/components/edit-request-modal'
import { RequestStatus, OperationDirection } from '@prisma/client'
import { toast } from 'sonner'

// Типы данных
interface Request {
  id: string
  requestId: string
  status: RequestStatus
  direction: OperationDirection
  createdAt: string
  updatedAt: string
  isOverdue: boolean
  timeToSLA: number | null
  slaDeadline: string | null
  client: {
    id: string
    username: string | null
    firstName: string | null
    lastName: string | null
  }
  office: {
    id: string
    name: string
    city: string
  } | null
  assignedUser: {
    id: string
    firstName: string
    lastName: string | null
    username: string
  } | null
  finance: {
    fromCurrency: string
    fromNetwork: string | null
    toCurrency: string
    expectedAmountFrom: number
    expectedAmountTo: number | null
    rateValue: number | null
    commissionPercent: number | null
  } | null
  _count: {
    attachments: number
    comments: number
  }
}

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

const statusConfig = {
  [RequestStatus.NEW]: {
    label: 'Новая',
    color: 'bg-blue-500',
    icon: Clock,
  },
  [RequestStatus.ASSIGNED]: {
    label: 'Назначена',
    color: 'bg-yellow-500',
    icon: UserCheck,
  },
  [RequestStatus.AWAITING_CLIENT]: {
    label: 'Ожидает клиента',
    color: 'bg-orange-500',
    icon: Clock,
  },
  [RequestStatus.IN_PROGRESS]: {
    label: 'В работе',
    color: 'bg-purple-500',
    icon: Edit,
  },
  [RequestStatus.AWAITING_CONFIRMATION]: {
    label: 'Ожидает подтверждения',
    color: 'bg-cyan-500',
    icon: Clock,
  },
  [RequestStatus.COMPLETED]: {
    label: 'Завершена',
    color: 'bg-green-500',
    icon: CheckCircle,
  },
  [RequestStatus.CANCELED]: {
    label: 'Отменена',
    color: 'bg-gray-500',
    icon: XCircle,
  },
  [RequestStatus.REJECTED]: {
    label: 'Отклонена',
    color: 'bg-red-500',
    icon: AlertTriangle,
  },
}

const directionLabels = {
  [OperationDirection.CRYPTO_TO_CASH]: 'Крипта → Наличные',
  [OperationDirection.CASH_TO_CRYPTO]: 'Наличные → Крипта',
  [OperationDirection.CARD_TO_CRYPTO]: 'Карта → Крипта',
  [OperationDirection.CRYPTO_TO_CARD]: 'Крипта → Карта',
  [OperationDirection.CARD_TO_CASH]: 'Карта → Наличные',
  [OperationDirection.CASH_TO_CARD]: 'Наличные → Карта',
}

export default function RequestsPage() {
  const router = useRouter()

  // Состояние
  const [requests, setRequests] = useState<Request[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationData | null>(null)

  // Фильтры
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [directionFilter, setDirectionFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  // Загрузка данных
  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '25', // Увеличили лимит для лучшего использования пространства
        sortBy,
        sortOrder,
      })

      if (search) params.set('search', search)
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter)
      if (directionFilter && directionFilter !== 'all') params.set('direction', directionFilter)

      const response = await fetch(`/api/requests?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()

      if (response.ok && data.success) {
        setRequests(data.data)
        setPagination(data.pagination)
      } else {
        throw new Error(data.error || 'Ошибка загрузки заявок')
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
      toast.error('Ошибка загрузки заявок')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [currentPage, sortBy, sortOrder, search, statusFilter, directionFilter])

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + R для обновления
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault()
        handleRefresh()
      }
      // Escape для очистки поиска
      if (event.key === 'Escape' && search) {
        setSearch('')
        setCurrentPage(1)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [search])

  // Обработчики
  const handleSearchChange = () => {
    setCurrentPage(1)
  }

  const handleViewRequest = (requestId: string) => {
    router.push(`/dashboard/requests/${requestId}`)
  }

  const handleEditRequest = (request: Request) => {
    setEditingRequestId(request.id)
    setIsEditModalOpen(true)
  }

  const handleRefresh = () => {
    fetchRequests()
    toast.success('Список заявок обновлен')
  }

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(amount) + ' ' + currency
  }

  const formatTimeToSLA = (timeToSLA: number | null) => {
    if (!timeToSLA) return null

    const hours = Math.floor(timeToSLA / (1000 * 60 * 60))
    const minutes = Math.floor((timeToSLA % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `${hours}ч ${minutes}м`
    }
    return `${minutes}м`
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col overflow-hidden">
      {/* Заголовок - фиксированная высота */}
      <div className="flex-shrink-0 border-b bg-background px-4 py-4 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Заявки</h2>
            <p className="text-sm text-muted-foreground">
              Управление заявками на обмен криптовалюты
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <CreateRequestModal onRequestCreated={fetchRequests} />
          </div>
        </div>
      </div>

      {/* Фильтры - компактные */}
      <div className="flex-shrink-0 border-b bg-muted/20 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Поиск по ID, клиенту, валюте..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  handleSearchChange()
                }}
                className="pl-10 h-9"
              />
            </div>
          </div>

          <div className="flex gap-2 lg:gap-3">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все статусы</SelectItem>
                {Object.entries(statusConfig).map(([key, config]) => (
                  <SelectItem key={key} value={key}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={directionFilter}
              onValueChange={(value) => {
                setDirectionFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="Направление" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все направления</SelectItem>
                {Object.entries(directionLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Основной контент - прокручиваемая область */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Информация о количестве */}
        <div className="flex-shrink-0 px-4 py-2 md:px-6 border-b bg-background">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {pagination && `Показано ${requests.length} из ${pagination.total} заявок`}
            </p>
            {loading && (
              <div className="text-sm text-muted-foreground">Загрузка...</div>
            )}
          </div>
        </div>

        {/* Таблица с прокруткой */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <div className="text-muted-foreground">Загрузка заявок...</div>
              </div>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <div className="text-muted-foreground">Заявок не найдено</div>
                {(search || statusFilter !== 'all' || directionFilter !== 'all') && (
                  <div className="text-sm text-muted-foreground mt-2">
                    Попробуйте изменить фильтры или поисковый запрос
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Мобильная версия - карточки */}
              <div className="block lg:hidden space-y-3 p-4">
                {requests.map((request) => {
                  const statusInfo = statusConfig[request.status]
                  const StatusIcon = statusInfo.icon

                  return (
                    <Card key={request.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 cursor-pointer" onClick={() => handleViewRequest(request.id)}>
                            <div className="font-mono text-sm font-medium">{request.requestId.replace('tg-', '')}</div>
                            <div className="text-sm text-muted-foreground">
                              {request.client.firstName} {request.client.lastName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className={`${statusInfo.color} text-white text-xs`}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {statusInfo.label}
                            </Badge>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0"
                              onClick={() => handleViewRequest(request.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <div className="text-muted-foreground text-xs">Направление</div>
                            <div className="font-medium">{request.finance?.fromCurrency} → {request.finance?.toCurrency}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Сумма</div>
                            <div className="font-medium">
                              {request.finance && new Intl.NumberFormat('ru-RU', {
                                maximumFractionDigits: 2,
                              }).format(request.finance.expectedAmountFrom)} {request.finance?.fromCurrency}
                            </div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">Дата</div>
                            <div>{format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</div>
                          </div>
                          <div>
                            <div className="text-muted-foreground text-xs">
                              {request.isOverdue ? 'SLA' : 'Офис'}
                            </div>
                            <div className="flex items-center gap-1">
                              {request.isOverdue ? (
                                <Badge variant="destructive" className="text-xs px-1 py-0">
                                  <AlertTriangle className="h-2 w-2 mr-1" />
                                  Просрочена
                                </Badge>
                              ) : (
                                request.office?.name || '-'
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Планшетная версия - компактная таблица */}
              <div className="hidden md:block lg:hidden overflow-x-auto">
                <Table className="min-w-[700px]">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-[60px]">ID</TableHead>
                      <TableHead className="w-[120px]">Клиент</TableHead>
                      <TableHead className="w-[100px]">Валюта</TableHead>
                      <TableHead className="w-[90px]">Сумма</TableHead>
                      <TableHead className="w-[100px]">Статус</TableHead>
                      <TableHead className="w-[70px]">Дата</TableHead>
                      <TableHead className="w-[50px] text-right">Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const statusInfo = statusConfig[request.status]
                      const StatusIcon = statusInfo.icon

                      return (
                        <TableRow key={request.id} className="h-12">
                          <TableCell className="font-mono text-xs p-1">
                            {request.requestId.replace('tg-', '').slice(-6)}
                          </TableCell>
                          <TableCell className="p-1">
                            <div className="max-w-[110px] truncate text-xs">
                              {request.client.firstName} {request.client.lastName}
                            </div>
                          </TableCell>
                          <TableCell className="p-1 text-xs">
                            {request.finance?.fromCurrency} → {request.finance?.toCurrency}
                          </TableCell>
                          <TableCell className="p-1 text-xs">
                            {request.finance && new Intl.NumberFormat('ru-RU', {
                              maximumFractionDigits: 0,
                            }).format(request.finance.expectedAmountFrom)}
                          </TableCell>
                          <TableCell className="p-1">
                            <Badge variant="secondary" className={`${statusInfo.color} text-white text-xs px-1 py-0.5`}>
                              <StatusIcon className="h-2 w-2" />
                            </Badge>
                          </TableCell>
                          <TableCell className="p-1 text-xs">
                            {format(new Date(request.createdAt), 'dd.MM', { locale: ru })}
                          </TableCell>
                          <TableCell className="text-right p-1">
                            <Button variant="ghost" className="h-6 w-6 p-0" onClick={() => handleViewRequest(request.id)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Десктопная версия - полная таблица */}
              <div className="hidden lg:block overflow-x-auto">
                <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead className="w-[140px]">Клиент</TableHead>
                  <TableHead className="w-[120px]">Направление</TableHead>
                  <TableHead className="w-[100px]">Сумма</TableHead>
                  <TableHead className="w-[100px]">Офис</TableHead>
                  <TableHead className="w-[100px]">Кассир</TableHead>
                  <TableHead className="w-[90px]">Статус</TableHead>
                  <TableHead className="w-[60px]">SLA</TableHead>
                  <TableHead className="w-[70px]">Дата</TableHead>
                  <TableHead className="w-[50px] text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => {
                  const statusInfo = statusConfig[request.status]
                  const StatusIcon = statusInfo.icon

                  return (
                    <TableRow key={request.id} className="h-12 hover:bg-muted/50 transition-colors">
                      {/* ID с tooltip */}
                      <TableCell className="font-mono text-xs p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer hover:text-primary transition-colors">
                              #{request.requestId.replace('tg-', '').slice(-6)}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Полный ID: {request.requestId}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Клиент с tooltip */}
                      <TableCell className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer hover:text-primary transition-colors">
                              <div className="font-medium text-xs truncate max-w-[120px]">
                                {request.client.firstName} {request.client.lastName}
                              </div>
                              {request.client.username && (
                                <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                                  @{request.client.username}
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p className="font-medium">
                                {request.client.firstName} {request.client.lastName}
                              </p>
                              {request.client.username && (
                                <p className="text-sm">@{request.client.username}</p>
                              )}
                              <p className="text-xs">ID: {request.client.id}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Направление с tooltip */}
                      <TableCell className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer">
                              <div className="font-medium text-xs truncate max-w-[100px]">
                                {request.finance?.fromCurrency} → {request.finance?.toCurrency}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[100px]">
                                {request.finance?.fromNetwork || 'Не указано'}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p className="font-medium">{directionLabels[request.direction]}</p>
                              <p>Из: {request.finance?.fromCurrency} ({request.finance?.fromNetwork || 'Не указано'})</p>
                              <p>В: {request.finance?.toCurrency}</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Сумма с tooltip */}
                      <TableCell className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer">
                              <div className="font-medium text-xs truncate max-w-[80px]">
                                {request.finance && new Intl.NumberFormat('ru-RU', {
                                  maximumFractionDigits: 0,
                                }).format(request.finance.expectedAmountFrom)}
                              </div>
                              <div className="text-xs text-muted-foreground truncate max-w-[80px]">
                                {request.finance?.fromCurrency}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p className="font-medium">
                                Ожидаемая сумма: {request.finance && formatAmount(
                                  request.finance.expectedAmountFrom,
                                  request.finance.fromCurrency
                                )}
                              </p>
                              {request.finance?.expectedAmountTo && (
                                <p>
                                  К получению: {formatAmount(
                                    request.finance.expectedAmountTo,
                                    request.finance.toCurrency
                                  )}
                                </p>
                              )}
                              {request.finance?.commissionPercent && (
                                <p className="text-xs">Комиссия: {request.finance.commissionPercent}%</p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Офис с tooltip */}
                      <TableCell className="p-2">
                        {request.office ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-pointer">
                                <div className="font-medium text-xs truncate max-w-[80px]">
                                  {request.office.name}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[80px]">
                                  {request.office.city}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-medium">{request.office.name}</p>
                                <p>{request.office.city}</p>
                                <p className="text-xs">ID: {request.office.id}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">Не назначен</span>
                        )}
                      </TableCell>

                      {/* Кассир с tooltip */}
                      <TableCell className="p-2">
                        {request.assignedUser ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-pointer">
                                <div className="font-medium text-xs truncate max-w-[80px]">
                                  {request.assignedUser.firstName} {request.assignedUser.lastName}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[80px]">
                                  @{request.assignedUser.username}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-medium">
                                  {request.assignedUser.firstName} {request.assignedUser.lastName}
                                </p>
                                <p>@{request.assignedUser.username}</p>
                                <p className="text-xs">ID: {request.assignedUser.id}</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">Не назначен</span>
                        )}
                      </TableCell>

                      {/* Статус с tooltip */}
                      <TableCell className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer">
                              <Badge
                                variant="secondary"
                                className={`${statusInfo.color} text-white text-xs px-2 py-1 max-w-[75px]`}
                              >
                                <StatusIcon className="mr-1 h-2 w-2 flex-shrink-0" />
                                <span className="truncate">{statusInfo.label}</span>
                              </Badge>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p className="font-medium">{statusInfo.label}</p>
                              <p className="text-xs">
                                Создано: {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                              </p>
                              {request.updatedAt !== request.createdAt && (
                                <p className="text-xs">
                                  Обновлено: {format(new Date(request.updatedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* SLA с tooltip */}
                      <TableCell className="p-2">
                        {request.isOverdue ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="destructive" className="text-xs px-1 py-0.5 cursor-pointer">
                                <AlertTriangle className="h-2 w-2 mr-1" />
                                Просрочена
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-medium text-red-500">SLA просрочен!</p>
                                {request.slaDeadline && (
                                  <p className="text-xs">
                                    Дедлайн: {format(new Date(request.slaDeadline), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : request.timeToSLA ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs font-medium cursor-pointer">
                                {formatTimeToSLA(request.timeToSLA)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div>
                                <p className="font-medium">Время до дедлайна SLA</p>
                                {request.slaDeadline && (
                                  <p className="text-xs">
                                    Дедлайн: {format(new Date(request.slaDeadline), 'dd.MM.yyyy HH:mm', { locale: ru })}
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-muted-foreground text-xs">Не установлен</span>
                        )}
                      </TableCell>

                      {/* Дата с tooltip */}
                      <TableCell className="p-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="cursor-pointer">
                              <div className="font-medium text-xs">
                                {format(new Date(request.createdAt), 'dd.MM.yy', { locale: ru })}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(request.createdAt), 'HH:mm', { locale: ru })}
                              </div>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div>
                              <p className="font-medium">
                                Создано: {format(new Date(request.createdAt), 'dd MMMM yyyy в HH:mm', { locale: ru })}
                              </p>
                              {request.updatedAt !== request.createdAt && (
                                <p className="text-xs">
                                  Изменено: {format(new Date(request.updatedAt), 'dd MMMM yyyy в HH:mm', { locale: ru })}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Действия */}
                      <TableCell className="text-right p-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-6 w-6 p-0 hover:bg-muted">
                              <MoreHorizontal className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewRequest(request.id)}>
                              <Eye className="mr-2 h-4 w-4" />
                              Просмотр
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditRequest(request)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Редактировать
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        {/* Пагинация - зафиксирована внизу */}
        {pagination && pagination.pages > 1 && (
          <div className="flex-shrink-0 border-t bg-background px-4 py-3 md:px-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Страница {pagination.page} из {pagination.pages} • Всего {pagination.total} заявок
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1 || loading}
                  className="h-8"
                >
                  {loading ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-2" />
                  ) : null}
                  Предыдущая
                </Button>
                <div className="text-xs text-muted-foreground px-2">
                  {currentPage}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                  disabled={currentPage === pagination.pages || loading}
                  className="h-8"
                >
                  Следующая
                  {loading ? (
                    <RefreshCw className="h-3 w-3 animate-spin ml-2" />
                  ) : null}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
      
      {/* Модальное окно редактирования */}
      <EditRequestModal
        requestId={editingRequestId}
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        onRequestUpdated={() => {
          fetchRequests()
          setEditingRequestId(null)
        }}
      />
    </TooltipProvider>
  )
}
