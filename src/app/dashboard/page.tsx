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
    color: 'bg-blue-500',
    icon: Clock,
  },
  [RequestStatus.ASSIGNED]: {
    label: 'Назначены',
    color: 'bg-yellow-500',
    icon: Users,
  },
  [RequestStatus.AWAITING_CLIENT]: {
    label: 'Ожидают клиента',
    color: 'bg-orange-500',
    icon: Clock,
  },
  [RequestStatus.IN_PROGRESS]: {
    label: 'В работе',
    color: 'bg-purple-500',
    icon: RefreshCw,
  },
  [RequestStatus.AWAITING_CONFIRMATION]: {
    label: 'Ожидают подтверждения',
    color: 'bg-cyan-500',
    icon: Clock,
  },
  [RequestStatus.COMPLETED]: {
    label: 'Завершены',
    color: 'bg-green-500',
    icon: CheckCircle,
  },
  [RequestStatus.CANCELED]: {
    label: 'Отменены',
    color: 'bg-gray-500',
    icon: XCircle,
  },
  [RequestStatus.REJECTED]: {
    label: 'Отклонены',
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
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8" suppressHydrationWarning>
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Дашборд</h2>
          <p className="text-muted-foreground">
            Обзор работы обменного сервиса
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[120px]">
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
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* KPI Карточки */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <Card key={index} className={kpi.trend === "critical" ? "border-red-500" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {kpi.title}
              </CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.trend === "critical" ? "text-red-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">
                {kpi.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Основной контент */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Недавние заявки */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Недавние заявки</CardTitle>
            <CardDescription>
              Последние заявки, требующие обработки
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.recentRequests.map((request) => {
                const statusInfo = statusConfig[request.status]
                const StatusIcon = statusInfo.icon

                return (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/dashboard/requests/${request.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col">
                        <p className="text-sm font-medium">
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
                    <div className="flex items-center space-x-2">
                      <Badge
                        variant="secondary"
                        className={`${statusInfo.color} text-white`}
                      >
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {statusInfo.label}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {stats.recentRequests.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  Нет недавних заявок
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Статистика по статусам */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>По статусам</CardTitle>
            <CardDescription>
              Распределение заявок
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.statusStats.map((stat) => {
              const statusInfo = statusConfig[stat.status]
              const StatusIcon = statusInfo.icon
              const percentage = stats.kpi.totalRequests > 0
                ? Math.round((stat.count / stats.kpi.totalRequests) * 100)
                : 0

              return (
                <div key={stat.status} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <StatusIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{statusInfo.label}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium">{stat.count}</span>
                    <span className="text-xs text-muted-foreground">({percentage}%)</span>
                  </div>
                </div>
              )
            })}
            {stats.statusStats.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                Нет данных
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Дополнительная статистика */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* По направлениям */}
        <Card>
          <CardHeader>
            <CardTitle>По направлениям</CardTitle>
            <CardDescription>
              Популярные направления обмена
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.directionStats.slice(0, 5).map((stat) => (
              <div key={stat.direction} className="flex items-center justify-between">
                <span className="text-sm">{directionLabels[stat.direction]}</span>
                <div className="text-right">
                  <div className="text-sm font-medium">{stat.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVolume(stat.volume)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* По валютам */}
        <Card>
          <CardHeader>
            <CardTitle>По валютам</CardTitle>
            <CardDescription>
              Самые популярные валюты
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {stats.currencyStats.slice(0, 5).map((stat) => (
              <div key={stat.currency} className="flex items-center justify-between">
                <span className="text-sm">{stat.currency}</span>
                <div className="text-right">
                  <div className="text-sm font-medium">{stat.count}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatVolume(stat.volume)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
