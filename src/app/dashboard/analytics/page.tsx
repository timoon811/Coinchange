"use client"

import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  RefreshCw,
  Activity,
  PieChart,
  TrendingDown,
  FileText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RequestStatus, OperationDirection } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'

// Импортируем типы из lib/types
import type { DashboardStats } from '@/lib/types'

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [analyticsData, setAnalyticsData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('7d')
  const [activeTab, setActiveTab] = useState('overview')
  const [realtimeInterval, setRealtimeInterval] = useState<NodeJS.Timeout | null>(null)

  const { execute: fetchAnalytics, loading: analyticsLoading } = useApi<DashboardStats>()

  // Загрузка данных аналитики
  const loadAnalytics = async (selectedPeriod: string = period) => {
    setLoading(true)
    const result = await fetchAnalytics(`/api/dashboard/stats?period=${selectedPeriod}`)
    if (result) {
      setAnalyticsData(result)
    }
    setLoading(false)
  }

  // Реальное время обновление
  const startRealtimeUpdates = () => {
    if (realtimeInterval) return

    const interval = setInterval(() => {
      loadAnalytics()
    }, 30000) // Обновление каждые 30 секунд

    setRealtimeInterval(interval)
  }

  const stopRealtimeUpdates = () => {
    if (realtimeInterval) {
      clearInterval(realtimeInterval)
      setRealtimeInterval(null)
    }
  }

  useEffect(() => {
    loadAnalytics()
    startRealtimeUpdates()

    return () => {
      stopRealtimeUpdates()
    }
  }, [])

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    loadAnalytics(newPeriod)
  }

  const formatVolume = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toLocaleString()
  }

  const formatTime = (minutes: number) => {
    return `${minutes} мин`
  }

  if (loading || !analyticsData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка аналитики...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Аналитика</h1>
          <p className="text-muted-foreground">
            Детальный анализ работы обменного сервиса
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">7 дней</SelectItem>
              <SelectItem value="30d">30 дней</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="year">Год</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={() => loadAnalytics()}
            disabled={analyticsLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${analyticsLoading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </div>

      {/* Период аналитики */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Период аналитики</p>
              <p className="text-lg font-medium">
                Период: {analyticsData.period}
              </p>
            </div>
            <Badge variant="outline">
              Аналитика
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Основные метрики */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Всего заявок</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpi?.totalRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              За выбранный период
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpi?.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Завершено заявок
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий объем</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVolume(analyticsData.kpi?.totalVolume || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Сумма операций
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Активные кассиры</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.activeCashiers || 0}</div>
            <p className="text-xs text-muted-foreground">
              В сети
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Детальные метрики */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Новые заявки</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpi?.newRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              В работе: {analyticsData.kpi?.inProgressRequests || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Завершено</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpi?.completedRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              Успешных операций
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Просрочено</CardTitle>
            <Activity className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.kpi?.overdueRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              Требует внимания
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Среднее время</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatTime(analyticsData.kpi?.averageCompletionTime || 0)}</div>
            <p className="text-xs text-muted-foreground">
              На обработку
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="trends">Тренды</TabsTrigger>
          <TabsTrigger value="details">Детали</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Распределение по статусам</CardTitle>
                <CardDescription>
                  Текущее состояние заявок
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(analyticsData.statusStats) && analyticsData.statusStats.map((stat) => (
                    <div key={stat.status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full bg-blue-500`} />
                        <span className="text-sm">{stat.status}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{stat.count}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>По валютам</CardTitle>
                <CardDescription>
                  Объем операций по валютам
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(analyticsData.currencyStats) && analyticsData.currencyStats.slice(0, 5).map((stat) => (
                    <div key={stat.currency} className="flex items-center justify-between">
                      <span className="text-sm">{stat.currency}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{stat.count}</div>
                        <div className="text-xs text-muted-foreground">{formatVolume(stat.volume)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Динамика за период</CardTitle>
              <CardDescription>
                Тренд заявок и объема по дням
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.isArray(analyticsData.dailyTrend) && analyticsData.dailyTrend.map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{format(new Date(day.date), 'dd.MM.yyyy', { locale: ru })}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{day.requests} заявок</div>
                      <div className="text-xs text-muted-foreground">{formatVolume(day.volume)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>По направлениям</CardTitle>
                <CardDescription>
                  Статистика по типам операций
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(analyticsData.directionStats) && analyticsData.directionStats.map((stat) => (
                    <div key={stat.direction} className="flex items-center justify-between">
                      <span className="text-sm">{stat.direction}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{stat.count}</div>
                        <div className="text-xs text-muted-foreground">{formatVolume(stat.volume)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>По офисам</CardTitle>
                <CardDescription>
                  Распределение по филиалам
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(analyticsData.officeStats) && analyticsData.officeStats.slice(0, 5).map((stat) => (
                    <div key={stat.officeId} className="flex items-center justify-between">
                      <span className="text-sm">{stat.officeId}</span>
                      <div className="text-right">
                        <div className="text-sm font-medium">{stat.count}</div>
                        <div className="text-xs text-muted-foreground">{formatVolume(stat.volume)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Недавние заявки</CardTitle>
              <CardDescription>
                Последние операции в системе
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.isArray(analyticsData.recentRequests) && analyticsData.recentRequests.slice(0, 5).map((request) => (
                  <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">#{request.requestId}</div>
                        <div className="text-xs text-muted-foreground">
                          {request.client?.firstName} {request.client?.lastName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{formatVolume(request.amount)}</div>
                      <div className="text-xs text-muted-foreground">{request.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
