"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Search,
  Filter,
  User,
  Phone,
  Tag,
  TrendingUp,
  Users,
  DollarSign,
  Eye,
  MoreHorizontal,
  Shield,
  ShieldOff,
  Star,
  Edit,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { CreateClientModal } from '@/components/create-client-modal'

// Типы данных
interface Client {
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
  lastContactDate: string | null
  isBlocked: boolean
  createdAt: string
  updatedAt: string
  requestsCount: number
}

interface PaginationData {
  page: number
  limit: number
  total: number
  pages: number
}

interface Filters {
  search: string
  tags: string[]
  blocked: boolean | null
  hasPhone: boolean | null
  minRequests: number | null
  maxRequests: number | null
  minVolume: number | null
  maxVolume: number | null
}

export default function ClientsPage() {
  const router = useRouter()

  // Состояние
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<PaginationData | null>(null)

  // Фильтры
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<Filters>({
    search: '',
    tags: [],
    blocked: null,
    hasPhone: null,
    minRequests: null,
    maxRequests: null,
    minVolume: null,
    maxVolume: null,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [createModalOpen, setCreateModalOpen] = useState(false)

  // Быстрые действия с клиентами
  const handleToggleTag = async (clientId: string, tag: string) => {
    try {
      const client = clients.find(c => c.id === clientId)
      if (!client) return

      const currentTags = client.tags || []
      const newTags = currentTags.includes(tag)
        ? currentTags.filter(t => t !== tag)
        : [...currentTags, tag]

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ tags: newTags }),
      })

      if (response.ok) {
        fetchClients() // Обновляем список
      }
    } catch (error) {
      console.error('Error toggling tag:', error)
    }
  }

  const handleToggleBlock = async (clientId: string) => {
    try {
      const client = clients.find(c => c.id === clientId)
      if (!client) return

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ isBlocked: !client.isBlocked }),
      })

      if (response.ok) {
        fetchClients() // Обновляем список
      }
    } catch (error) {
      console.error('Error toggling block:', error)
    }
  }

  // Загрузка клиентов
  const fetchClients = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20',
        sortBy,
        sortOrder,
      })

      if (search) params.set('search', search)
      if (filters.tags.length > 0) params.set('tags', filters.tags.join(','))
      if (filters.blocked !== null) params.set('blocked', filters.blocked.toString())
      if (filters.hasPhone !== null) params.set('hasPhone', filters.hasPhone.toString())
      if (filters.minRequests !== null) params.set('minRequests', filters.minRequests.toString())
      if (filters.maxRequests !== null) params.set('maxRequests', filters.maxRequests.toString())
      if (filters.minVolume !== null) params.set('minVolume', filters.minVolume.toString())
      if (filters.maxVolume !== null) params.set('maxVolume', filters.maxVolume.toString())

      const response = await fetch(`/api/clients?${params}`)
      const data = await response.json()

      if (data.success) {
        setClients(data.data)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [currentPage, sortBy, sortOrder])

  // Обработчики
  const handleSearch = () => {
    setCurrentPage(1)
    fetchClients()
  }

  const handleFilterChange = () => {
    setCurrentPage(1)
    fetchClients()
  }

  const handleViewClient = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}`)
  }

  const handleEditClient = (clientId: string) => {
    router.push(`/dashboard/clients/${clientId}?edit=true`)
  }

  const formatVolumeCompact = (amount: number | string | null | undefined) => {
    if (!amount) return '$0.00'
    
    // Конвертируем в число если это строка
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
    
    // Проверяем что это валидное число
    if (isNaN(numAmount) || numAmount === null || numAmount === undefined) {
      return '$0.00'
    }
    
    if (numAmount >= 1000000) {
      return `$${(numAmount / 1000000).toFixed(2)}M`
    } else if (numAmount >= 1000) {
      return `$${(numAmount / 1000).toFixed(2)}K`
    }
    return `$${numAmount.toFixed(2)}`
  }

  const getClientInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || 'U'
  }

  const getClientDisplayName = (client: Client) => {
    if (client.firstName || client.lastName) {
      return `${client.firstName || ''} ${client.lastName || ''}`.trim()
    }
    return client.username || `ID: ${client.telegramUserId}`
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-6 max-w-full">
      <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Клиенты</h2>
          <p className="text-muted-foreground">
            Управление клиентами и их историей операций
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => setCreateModalOpen(true)}>
            <User className="mr-2 h-4 w-4" />
            Добавить клиента
          </Button>
        </div>
      </div>

      {/* Фильтры */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Фильтры</CardTitle>
          <CardDescription>
            Используйте фильтры для поиска нужных клиентов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени, username, телефону..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-8"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Select
                value={filters.blocked === null ? 'all' : filters.blocked ? 'blocked' : 'active'}
                onValueChange={(value) => {
                  setFilters(prev => ({
                    ...prev,
                    blocked: value === 'all' ? null : value === 'blocked'
                  }))
                }}
              >
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="active">Активные</SelectItem>
                  <SelectItem value="blocked">Заблокированные</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.hasPhone === null ? 'all' : filters.hasPhone ? 'with_phone' : 'without_phone'}
                onValueChange={(value) => {
                  setFilters(prev => ({
                    ...prev,
                    hasPhone: value === 'all' ? null : value === 'with_phone'
                  }))
                }}
              >
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  <SelectItem value="with_phone">С телефоном</SelectItem>
                  <SelectItem value="without_phone">Без телефона</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleFilterChange} variant="outline" className="w-full sm:w-auto">
                <Filter className="mr-2 h-4 w-4" />
                Применить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Статистика клиентов */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего клиентов</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активных</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(clients) ? clients.filter(c => !c.isBlocked).length : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VIP клиенты</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(clients) ? clients.filter(c => c.tags && c.tags.includes('VIP')).length : 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий объем</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold break-words">
              {formatVolumeCompact(clients.reduce((sum, c) => sum + (c.totalVolume || 0), 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Таблица клиентов */}
      <Card>
        <CardHeader>
          <CardTitle>Список клиентов</CardTitle>
          <CardDescription>
            {pagination && `Показано ${clients.length} из ${pagination.total} клиентов`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Загрузка...</div>
            </div>
          ) : clients.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Клиенты не найдены</div>
            </div>
          ) : (
            <>
              {/* Таблица для больших экранов */}
              <div className="hidden xl:block">
                <div className="w-full max-w-full">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Клиент</TableHead>
                        <TableHead className="w-[140px]">Контакты</TableHead>
                        <TableHead className="w-[120px]">Метки</TableHead>
                        <TableHead className="w-[140px]">Статистика</TableHead>
                        <TableHead className="w-[120px]">Статус</TableHead>
                        <TableHead className="w-[100px]">Дата</TableHead>
                        <TableHead className="w-[80px] text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="w-[200px]">
                          <div className="flex items-center space-x-2">
                            <Avatar className="h-7 w-7 flex-shrink-0">
                              <AvatarFallback className="text-xs">
                                {getClientInitials(client.firstName, client.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-sm truncate">
                                {getClientDisplayName(client)}
                              </p>
                              {client.username && (
                                <p className="text-xs text-muted-foreground truncate">
                                  @{client.username}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-[140px]">
                          <div className="text-xs">
                            {client.phone ? (
                              <div className="flex items-center">
                                <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                                <span className="truncate">{client.phone}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">Нет телефона</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-[120px]">
                          <div className="flex flex-wrap gap-1">
                            {client.tags?.slice(0, 1).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            )) || []}
                            {client.tags && client.tags.length > 1 && (
                              <Badge variant="outline" className="text-xs">
                                +{client.tags.length - 1}
                              </Badge>
                            )}
                            {(!client.tags || client.tags.length === 0) && (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="w-[140px]">
                          <div className="text-xs">
                            <div>Заявок: {client.totalRequests}</div>
                            <div className="text-muted-foreground">
                              {formatVolumeCompact(client.totalVolume)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="w-[120px]">
                          <Badge variant={client.isBlocked ? "destructive" : "secondary"} className="text-xs">
                            {client.isBlocked ? (
                              <>
                                <ShieldOff className="h-3 w-3 mr-1" />
                                Заблок.
                              </>
                            ) : (
                              <>
                                <Shield className="h-3 w-3 mr-1" />
                                Активен
                              </>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className="w-[100px]">
                          <div className="text-xs">
                            {format(new Date(client.createdAt), 'dd.MM.yy', { locale: ru })}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewClient(client.id)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Просмотр
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClient(client.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Редактировать
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleTag(client.id, 'VIP')}>
                                <Star className="mr-2 h-4 w-4" />
                                {client.tags?.includes('VIP') ? 'Убрать VIP' : 'Добавить VIP'}
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleToggleBlock(client.id)}
                                className={client.isBlocked ? 'text-green-600' : 'text-red-600'}
                              >
                                {client.isBlocked ? (
                                  <>
                                    <Shield className="mr-2 h-4 w-4" />
                                    Разблокировать
                                  </>
                                ) : (
                                  <>
                                    <ShieldOff className="mr-2 h-4 w-4" />
                                    Заблокировать
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              </div>

              {/* Компактная таблица для средних экранов */}
              <div className="hidden lg:block xl:hidden">
                <div className="w-full max-w-full">
                  <Table className="table-fixed w-full">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[250px]">Клиент</TableHead>
                        <TableHead className="w-[180px]">Статистика</TableHead>
                        <TableHead className="w-[120px]">Статус</TableHead>
                        <TableHead className="w-[80px] text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="w-[250px]">
                            <div className="flex items-center space-x-3">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className="text-xs">
                                  {getClientInitials(client.firstName, client.lastName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">
                                  {getClientDisplayName(client)}
                                </p>
                                <div className="flex items-center text-xs text-muted-foreground">
                                  {client.username && <span className="truncate">@{client.username}</span>}
                                  {client.phone && (
                                    <>
                                      {client.username && <span className="mx-1">•</span>}
                                      <Phone className="h-3 w-3 mr-1" />
                                      <span className="truncate">{client.phone}</span>
                                    </>
                                  )}
                                </div>
                                {client.tags && client.tags.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {client.tags.slice(0, 2).map((tag) => (
                                      <Badge key={tag} variant="secondary" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                    {client.tags.length > 2 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{client.tags.length - 2}
                                      </Badge>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="w-[180px]">
                            <div className="text-sm">
                              <div>Заявок: {client.totalRequests}</div>
                              <div className="text-muted-foreground">
                                Объем: {formatVolumeCompact(client.totalVolume)}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {format(new Date(client.createdAt), 'dd.MM.yyyy', { locale: ru })}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="w-[120px]">
                            <Badge variant={client.isBlocked ? "destructive" : "secondary"} className="text-xs">
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
                          </TableCell>
                          <TableCell className="w-[80px] text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewClient(client.id)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Просмотр
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleEditClient(client.id)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Редактировать
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleToggleTag(client.id, 'VIP')}>
                                  <Star className="mr-2 h-4 w-4" />
                                  {client.tags?.includes('VIP') ? 'Убрать VIP' : 'Добавить VIP'}
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  onClick={() => handleToggleBlock(client.id)}
                                  className={client.isBlocked ? 'text-green-600' : 'text-red-600'}
                                >
                                  {client.isBlocked ? (
                                    <>
                                      <Shield className="mr-2 h-4 w-4" />
                                      Разблокировать
                                    </>
                                  ) : (
                                    <>
                                      <ShieldOff className="mr-2 h-4 w-4" />
                                      Заблокировать
                                    </>
                                  )}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Карточки для мобильных устройств */}
              <div className="lg:hidden space-y-4">
                {clients.map((client) => (
                  <Card key={client.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <Avatar className="h-10 w-10 flex-shrink-0">
                          <AvatarFallback className="text-sm">
                            {getClientInitials(client.firstName, client.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {getClientDisplayName(client)}
                          </p>
                          {client.username && (
                            <p className="text-sm text-muted-foreground truncate">
                              @{client.username}
                            </p>
                          )}
                          {client.phone && (
                            <div className="flex items-center text-sm text-muted-foreground mt-1">
                              <Phone className="h-3 w-3 mr-1 flex-shrink-0" />
                              <span className="truncate">{client.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0 flex-shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewClient(client.id)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Просмотр
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditClient(client.id)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleTag(client.id, 'VIP')}>
                            <Star className="mr-2 h-4 w-4" />
                            {client.tags?.includes('VIP') ? 'Убрать VIP' : 'Добавить VIP'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleToggleBlock(client.id)}
                            className={client.isBlocked ? 'text-green-600' : 'text-red-600'}
                          >
                            {client.isBlocked ? (
                              <>
                                <Shield className="mr-2 h-4 w-4" />
                                Разблокировать
                              </>
                            ) : (
                              <>
                                <ShieldOff className="mr-2 h-4 w-4" />
                                Заблокировать
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Статус:</span>
                        <Badge variant={client.isBlocked ? "destructive" : "secondary"} className="text-xs">
                          {client.isBlocked ? 'Заблокирован' : 'Активен'}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Заявок:</span>
                        <span>{client.totalRequests}</span>
                      </div>
                      
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Объем:</span>
                        <span className="break-words text-right">{formatVolumeCompact(client.totalVolume)}</span>
                      </div>
                      
                      {client.tags && client.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {client.tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {client.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{client.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground mt-2">
                        Зарегистрирован: {format(new Date(client.createdAt), 'dd.MM.yyyy', { locale: ru })}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Пагинация */}
          {pagination && pagination.pages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4">
              <div className="text-sm text-muted-foreground order-2 sm:order-1">
                Страница {pagination.page} из {pagination.pages}
              </div>
              <div className="flex space-x-2 order-1 sm:order-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Предыдущая
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                  disabled={currentPage === pagination.pages}
                >
                  Следующая
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Модальное окно добавления клиента */}
      <CreateClientModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onClientCreated={() => {
          fetchClients()
          setCreateModalOpen(false)
        }}
      />
    </div>
  )
}
