"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Clock,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  DollarSign,
  Timer,
  Target,
  RefreshCw,
  Eye,
} from "lucide-react"
import { RequestStatus, OperationDirection } from '@prisma/client'

interface DashboardStats {
  kpi: {
    totalRequests: number
    newRequests: number
    inProgressRequests: number
    completedRequests: number
    overdueRequests: number
    totalVolume: number
    averageCompletionTime: number
    conversionRate: number
  }
  statusStats: Array<{
    status: RequestStatus
    count: number
  }>
  directionStats: Array<{
    direction: OperationDirection
    count: number
    volume: number
  }>
  currencyStats: Array<{
    currency: string
    count: number
    volume: number
  }>
  officeStats: Array<{
    officeId: string
    count: number
    volume: number
  }>
  dailyTrend: Array<{
    date: string
    requests: number
    volume: number
  }>
  recentRequests: Array<{
    id: string
    requestId: string
    client: {
      firstName: string | null
      lastName: string | null
      username: string | null
    }
    direction: OperationDirection
    amount: number
    currency: string
    office: string
    status: RequestStatus
    createdAt: string
  }>
  activeCashiers: number
  period: string
}

const statusConfig = {
  [RequestStatus.NEW]: {
    label: 'Новые',
    color: 'status-new',
    icon: Clock,
  },
  [RequestStatus.ASSIGNED]: {
    label: 'Назначены',
    color: 'status-assigned',
    icon: Users,
  },
  [RequestStatus.AWAITING_CLIENT]: {
    label: 'Ожидают клиента',
    color: 'status-assigned',
    icon: Clock,
  },
  [RequestStatus.IN_PROGRESS]: {
    label: 'В работе',
    color: 'status-in-progress',
    icon: RefreshCw,
  },
  [RequestStatus.AWAITING_CONFIRMATION]: {
    label: 'Ожидают подтверждения',
    color: 'status-assigned',
    icon: Clock,
  },
  [RequestStatus.COMPLETED]: {
    label: 'Завершены',
    color: 'status-completed',
    icon: CheckCircle,
  },
  [RequestStatus.CANCELED]: {
    label: 'Отменены',
    color: 'status-overdue',
    icon: XCircle,
  },
  [RequestStatus.REJECTED]: {
    label: 'Отклонены',
    color: 'status-overdue',
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

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [refreshing, setRefreshing] = useState(false)

  // Загрузка статистики
  const fetchStats = async (selectedPeriod: string = period) => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/dashboard/stats?period=${selectedPeriod}`)
      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    fetchStats(newPeriod)
  }

  const handleRefresh = () => {
    fetchStats()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatVolume = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toString()
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Загрузка...</div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Ошибка загрузки данных</div>
        </div>
      </div>
    )
  }

  const kpiCards = [
    {
      title: "Всего заявок",
      value: stats.kpi.totalRequests.toString(),
      description: `За ${period === '1d' ? 'сегодня' : period === '7d' ? 'неделю' : 'месяц'}`,
      icon: TrendingUp,
      trend: null,
    },
    {
      title: "Новые заявки",
      value: stats.kpi.newRequests.toString(),
      description: "Требуют обработки",
      icon: Clock,
      trend: null,
    },
    {
      title: "В работе",
      value: stats.kpi.inProgressRequests.toString(),
      description: "Активных заявок",
      icon: RefreshCw,
      trend: null,
    },
    {
      title: "Завершено",
      value: stats.kpi.completedRequests.toString(),
      description: `Конверсия: ${stats.kpi.conversionRate}%`,
      icon: CheckCircle,
      trend: null,
    },
    {
      title: "Просрочено",
      value: stats.kpi.overdueRequests.toString(),
      description: "Требуют внимания",
      icon: AlertTriangle,
      trend: stats.kpi.overdueRequests > 0 ? "critical" : null,
    },
    {
      title: "Объем",
      value: formatVolume(stats.kpi.totalVolume),
      description: "Общая сумма",
      icon: DollarSign,
      trend: null,
    },
    {
      title: "Среднее время",
      value: `${stats.kpi.averageCompletionTime} мин`,
      description: "На обработку",
      icon: Timer,
      trend: null,
    },
    {
      title: "Активные кассиры",
      value: stats.activeCashiers.toString(),
      description: "В сети",
      icon: Users,
      trend: null,
    },
  ]

  return (
    <div className="flex-1 space-y-8 p-6 pt-8 md:p-10" suppressHydrationWarning>
      <div className="flex items-center justify-between space-y-2 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Дашборд
          </h1>
          <p className="text-lg text-muted-foreground">
            Обзор работы обменного сервиса
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px] h-11 bg-background/50 backdrop-blur-sm border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Сегодня</SelectItem>
              <SelectItem value="7d">7 дней</SelectItem>
              <SelectItem value="30d">30 дней</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="lg"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-11 px-6"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* KPI Карточки */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <Card 
            key={index} 
            className={`animate-fade-in group stable-layout smooth-hover ${
              kpi.trend === "critical" 
                ? "border-red-500/50 bg-red-500/5 shadow-red-500/10" 
                : "hover:border-primary/20 hover:shadow-primary/5"
            }`}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`p-2 rounded-lg no-scale-hover ${
                kpi.trend === "critical" 
                  ? "bg-red-500/10 text-red-500" 
                  : "bg-primary/10 text-primary group-hover:bg-primary/20"
              }`}>
                <kpi.icon className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-bold tracking-tight">{kpi.value}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Основной контент */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Недавние заявки */}
        <Card className="col-span-4 animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Недавние заявки</CardTitle>
            <CardDescription className="text-base">
              Последние заявки, требующие обработки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentRequests.map((request, index) => {
                const statusInfo = statusConfig[request.status]
                const StatusIcon = statusInfo.icon

                return (
                  <div
                    key={request.id}
                    className="group flex items-center justify-between p-5 border border-border/50 rounded-xl hover:bg-muted/30 cursor-pointer stable-layout smooth-hover hover:shadow-md"
                    onClick={() => router.push(`/dashboard/requests/${request.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col space-y-1">
                        <p className="text-base font-semibold">
                          {request.client.firstName} {request.client.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {directionLabels[request.direction]} • {formatCurrency(request.amount)} {request.currency}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {request.office} • {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge
                        variant="outline"
                        className={`${statusInfo.color} border shadow-sm hover:shadow-md no-scale-hover`}
                      >
                        <StatusIcon className="mr-1.5 h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                      <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 no-scale-hover">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {stats.recentRequests.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="text-4xl mb-4">📋</div>
                  <p className="text-lg">Нет недавних заявок</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Статистика по статусам */}
        <Card className="col-span-3 animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">По статусам</CardTitle>
            <CardDescription className="text-base">
              Распределение заявок
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {stats.statusStats.map((stat, index) => {
              const statusInfo = statusConfig[stat.status]
              const StatusIcon = statusInfo.icon
              const percentage = stats.kpi.totalRequests > 0
                ? Math.round((stat.count / stats.kpi.totalRequests) * 100)
                : 0

              return (
                <div 
                  key={stat.status} 
                  className="group flex items-center justify-between p-4 rounded-lg hover:bg-muted/30 stable-layout smooth-hover"
                >
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 no-scale-hover">
                      <StatusIcon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-medium">{statusInfo.label}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-lg font-bold">{stat.count}</span>
                    <div className="flex items-center space-x-1">
                      <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full no-scale-hover"
                          style={{ 
                            width: `${percentage}%`,
                            transition: 'width 300ms ease'
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground min-w-[3rem]">({percentage}%)</span>
                    </div>
                  </div>
                </div>
              )
            })}
            {stats.statusStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-3">📊</div>
                <p className="text-base">Нет данных</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Дополнительная статистика */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* По направлениям */}
        <Card className="animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">По направлениям</CardTitle>
            <CardDescription className="text-base">
              Популярные направления обмена
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {stats.directionStats.slice(0, 5).map((stat, index) => (
              <div 
                key={stat.direction} 
                className="group flex items-center justify-between p-4 rounded-lg hover:bg-muted/30 stable-layout smooth-hover"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 text-primary">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{directionLabels[stat.direction]}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{stat.count}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatVolume(stat.volume)}
                  </div>
                </div>
              </div>
            ))}
            {stats.directionStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-3">📈</div>
                <p className="text-base">Нет данных</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* По валютам */}
        <Card className="animate-fade-in">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">По валютам</CardTitle>
            <CardDescription className="text-base">
              Самые популярные валюты
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {stats.currencyStats.slice(0, 5).map((stat, index) => (
              <div 
                key={stat.currency} 
                className="group flex items-center justify-between p-4 rounded-lg hover:bg-muted/30 stable-layout smooth-hover"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/10 to-green-500/5 text-green-600">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium">{stat.currency}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{stat.count}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatVolume(stat.volume)}
                  </div>
                </div>
              </div>
            ))}
            {stats.currencyStats.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <div className="text-3xl mb-3">💰</div>
                <p className="text-base">Нет данных</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
