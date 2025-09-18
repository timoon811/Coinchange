"use client"

import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Download,
  FileText,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Calendar,
  Filter,
  RefreshCw,
  Eye,
  FileSpreadsheet,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RequestStatus, OperationDirection } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import type { ExportType, ExportFormat, ProfitReportData, TurnoverReportData } from '@/lib/types'

// Типы данных
interface ReportData {
  period: {
    start: string
    end: string
    label: string
  }
  summary: {
    totalRequests: number
    newRequests: number
    completedRequests: number
    cancelledRequests: number
    totalVolume: number
    avgProcessingTime: number
    uniqueClients: number
    conversionRate: number
    cancellationRate: number
  }
  statusBreakdown: Array<{
    status: RequestStatus
    count: number
    percentage: number
  }>
  directionBreakdown: Array<{
    direction: OperationDirection
    count: number
    volume: number
    percentage: number
  }>
  currencyBreakdown: Array<{
    currency: string
    count: number
    volume: number
  }>
  officeBreakdown: Array<{
    officeId: string
    count: number
    volume: number
  }>
  topClients: Array<{
    clientId: string
    client: {
      id: string
      firstName: string | null
      lastName: string | null
      username: string | null
    } | undefined
    volume: number
  }>
  dailyStats: Array<{
    date: string
    requests: number
    volume: number
  }>
}

const statusConfig = {
  [RequestStatus.NEW]: { label: 'Новые', color: 'bg-blue-500' },
  [RequestStatus.ASSIGNED]: { label: 'Назначены', color: 'bg-yellow-500' },
  [RequestStatus.AWAITING_CLIENT]: { label: 'Ожидают клиента', color: 'bg-orange-500' },
  [RequestStatus.IN_PROGRESS]: { label: 'В работе', color: 'bg-purple-500' },
  [RequestStatus.AWAITING_CONFIRMATION]: { label: 'Ожидают подтверждения', color: 'bg-cyan-500' },
  [RequestStatus.COMPLETED]: { label: 'Завершены', color: 'bg-green-500' },
  [RequestStatus.CANCELED]: { label: 'Отменены', color: 'bg-gray-500' },
  [RequestStatus.REJECTED]: { label: 'Отклонены', color: 'bg-red-500' },
}

const directionLabels = {
  [OperationDirection.CRYPTO_TO_CASH]: 'Крипта → Наличные',
  [OperationDirection.CASH_TO_CRYPTO]: 'Наличные → Крипта',
  [OperationDirection.CARD_TO_CRYPTO]: 'Карта → Крипта',
  [OperationDirection.CRYPTO_TO_CARD]: 'Крипта → Карта',
  [OperationDirection.CARD_TO_CASH]: 'Карта → Наличные',
  [OperationDirection.CASH_TO_CARD]: 'Наличные → Карта',
}

export default function ReportsPage() {
  const { user } = useAuth()
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [profitData, setProfitData] = useState<ProfitReportData | null>(null)
  const [turnoverData, setTurnoverData] = useState<TurnoverReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30d')
  const [activeTab, setActiveTab] = useState('overview')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)

  // Параметры экспорта
  const [exportType, setExportType] = useState<ExportType>('requests')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [exportFilters, setExportFilters] = useState({
    status: [] as RequestStatus[],
    direction: [] as OperationDirection[],
    officeId: [] as string[],
  })

  const { execute: fetchReport, loading: reportLoading } = useApi<ReportData>()

  // Загрузка данных отчета
  const loadReport = async (selectedPeriod: string = period) => {
    try {
      setLoading(true)
      
      const periodParams = getPeriodParams(selectedPeriod)
      
      const [overviewResult, profitResult, turnoverResult] = await Promise.all([
        fetchReport(`/api/reports/overview?period=${selectedPeriod}`).catch(err => {
          console.error('Error loading overview report:', err)
          return null
        }),
        user?.role === 'ADMIN' ? 
          fetchReport(`/api/reports/profit?${periodParams}`).catch(err => {
            console.error('Error loading profit report:', err)
            return null
          }) : 
          Promise.resolve(null),
        fetchReport(`/api/reports/turnover?${periodParams}`).catch(err => {
          console.error('Error loading turnover report:', err)
          return null
        })
      ])
      
      if (overviewResult) {
        setReportData(overviewResult)
      }
      if (profitResult) {
        setProfitData(profitResult)
      }
      if (turnoverResult) {
        setTurnoverData(turnoverResult)
      }
    } catch (error) {
      console.error('Error loading reports:', error)
    } finally {
      setLoading(false)
    }
  }

  // Преобразование периода в параметры даты
  const getPeriodParams = (selectedPeriod: string) => {
    const endDate = new Date()
    let startDate = new Date()
    
    switch (selectedPeriod) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7)
        break
      case '30d':
        startDate.setDate(endDate.getDate() - 30)
        break
      case '90d':
        startDate.setDate(endDate.getDate() - 90)
        break
      case 'month':
        startDate = new Date(endDate.getFullYear(), endDate.getMonth(), 1)
        break
      case 'year':
        startDate = new Date(endDate.getFullYear(), 0, 1)
        break
    }
    
    return `dateFrom=${startDate.toISOString().split('T')[0]}&dateTo=${endDate.toISOString().split('T')[0]}`
  }

  useEffect(() => {
    loadReport()
  }, [])

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    loadReport(newPeriod)
  }

  const handleExport = () => {
    const params = new URLSearchParams({
      type: exportType,
      format: exportFormat,
      period,
    })

    if (exportFilters.status.length > 0) {
      params.set('status', exportFilters.status.join(','))
    }

    if (exportFilters.direction.length > 0) {
      params.set('direction', exportFilters.direction.join(','))
    }

    if (exportFilters.officeId.length > 0) {
      params.set('officeId', exportFilters.officeId.join(','))
    }

    const url = `/api/reports/export?${params}`
    window.open(url, '_blank')
    setExportDialogOpen(false)
  }

  const formatVolume = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toLocaleString()
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Загрузка отчета...</p>
        </div>
      </div>
    )
  }

  if (!reportData) {
    return (
      <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Отчеты</h1>
            <p className="text-muted-foreground">
              Аналитика работы обменного сервиса
            </p>
          </div>
          <Button onClick={() => loadReport()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Повторить загрузку
          </Button>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Не удалось загрузить данные отчета</p>
            <Button onClick={() => loadReport()}>
              Попробовать снова
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Отчеты</h1>
          <p className="text-muted-foreground">
            Аналитика работы обменного сервиса
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
              <SelectItem value="90d">90 дней</SelectItem>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="year">Год</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Экспорт
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Экспорт отчета</DialogTitle>
                <DialogDescription>
                  Выберите тип отчета и формат для экспорта
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Тип отчета</Label>
                  <Select value={exportType} onValueChange={(value: string) => setExportType(value as ExportType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="requests">Заявки</SelectItem>
                      <SelectItem value="clients">Клиенты</SelectItem>
                      <SelectItem value="finance">Финансы</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Формат</Label>
                  <Select value={exportFormat} onValueChange={(value: string) => setExportFormat(value as ExportFormat)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="xlsx">Excel (XLSX)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Фильтры (опционально)</Label>
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label className="text-sm">Статусы</Label>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {Object.entries(statusConfig).map(([key, config]) => (
                          <div key={key} className="flex items-center space-x-2">
                            <Checkbox
                              id={`status-${key}`}
                              checked={exportFilters.status.includes(key as RequestStatus)}
                              onCheckedChange={(checked) => {
                                setExportFilters(prev => ({
                                  ...prev,
                                  status: checked
                                    ? [...prev.status, key as RequestStatus]
                                    : prev.status.filter(s => s !== key)
                                }))
                              }}
                            />
                            <Label htmlFor={`status-${key}`} className="text-sm">
                              {config.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Скачать
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Период отчета */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Период отчета</p>
              <p className="text-lg font-medium">
                {reportData.period?.start ? format(new Date(reportData.period.start), 'dd.MM.yyyy', { locale: ru }) : 'Н/Д'} - {' '}
                {reportData.period?.end ? format(new Date(reportData.period.end), 'dd.MM.yyyy', { locale: ru }) : 'Н/Д'}
              </p>
            </div>
            <Badge variant="outline">
              {reportData.period?.label === '7d' && '7 дней'}
              {reportData.period?.label === '30d' && '30 дней'}
              {reportData.period?.label === '90d' && '90 дней'}
              {reportData.period?.label === 'month' && 'Месяц'}
              {reportData.period?.label === 'year' && 'Год'}
              {(!reportData.period?.label || !['7d', '30d', '90d', 'month', 'year'].includes(reportData.period.label)) && 'Неизвестный период'}
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
            <div className="text-2xl font-bold">{reportData.summary?.totalRequests || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{reportData.summary?.newRequests || 0} новых
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Конверсия</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary?.conversionRate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              {reportData.summary?.completedRequests || 0} завершено
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Общий объем</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatVolume(reportData.summary?.totalVolume || 0)}</div>
            <p className="text-xs text-muted-foreground">
              Средний чек: {formatVolume((reportData.summary?.totalVolume || 0) / (reportData.summary?.totalRequests || 1))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Уникальные клиенты</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData.summary?.uniqueClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Ср. время: {reportData.summary?.avgProcessingTime || 0} мин
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="status">По статусам</TabsTrigger>
          <TabsTrigger value="directions">По направлениям</TabsTrigger>
          <TabsTrigger value="clients">Топ клиентов</TabsTrigger>
          {user?.role === 'ADMIN' && <TabsTrigger value="profit">Прибыль</TabsTrigger>}
          <TabsTrigger value="turnover">Оборот</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Распределение по статусам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(reportData.statusBreakdown) && reportData.statusBreakdown.map((stat) => (
                    <div key={stat.status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className={`w-3 h-3 rounded-full ${statusConfig[stat.status].color}`} />
                        <span className="text-sm">{statusConfig[stat.status].label}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{stat.count}</div>
                        <div className="text-xs text-muted-foreground">{stat.percentage}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>По валютам</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray(reportData.currencyBreakdown) && reportData.currencyBreakdown.slice(0, 5).map((stat) => (
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

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Детальная статистика по статусам</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Количество</TableHead>
                    <TableHead className="text-right">Процент</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(reportData.statusBreakdown) && reportData.statusBreakdown.map((stat) => (
                    <TableRow key={stat.status}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className={`w-3 h-3 rounded-full ${statusConfig[stat.status].color}`} />
                          <span>{statusConfig[stat.status].label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{stat.count}</TableCell>
                      <TableCell className="text-right">{stat.percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="directions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Статистика по направлениям обмена</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Направление</TableHead>
                    <TableHead className="text-right">Количество</TableHead>
                    <TableHead className="text-right">Объем</TableHead>
                    <TableHead className="text-right">Процент</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(reportData.directionBreakdown) && reportData.directionBreakdown.map((stat) => (
                    <TableRow key={stat.direction}>
                      <TableCell>{directionLabels[stat.direction]}</TableCell>
                      <TableCell className="text-right font-medium">{stat.count}</TableCell>
                      <TableCell className="text-right">{formatVolume(stat.volume)}</TableCell>
                      <TableCell className="text-right">{stat.percentage}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Топ клиентов по объему</CardTitle>
              <CardDescription>
                Клиенты с наибольшим объемом операций
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Клиент</TableHead>
                    <TableHead className="text-right">Объем</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.isArray(reportData.topClients) && reportData.topClients.slice(0, 10).map((client, index) => (
                    <TableRow key={client.clientId}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium">
                              {client.client?.firstName || client.client?.username || 'Неизвестный'}
                            </div>
                            {client.client?.username && (
                              <div className="text-sm text-muted-foreground">
                                @{client.client.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatVolume(client.volume)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка прибыли (только для админов) */}
        {user?.role === 'ADMIN' && (
          <TabsContent value="profit" className="space-y-4">
            {profitData ? (
              <>
                {/* Основные метрики прибыли */}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Валовая прибыль</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600">
                        {formatCurrency(profitData.grossProfit)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Чистая прибыль</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-600">
                        {formatCurrency(profitData.netProfit)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Доходы</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {formatCurrency(profitData.revenue)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Расходы</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600">
                        {formatCurrency(profitData.expenses)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Топ валют по прибыли</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {profitData.topCurrencies.slice(0, 5).map((currency, index) => (
                          <div key={currency.currency} className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                                {index + 1}
                              </div>
                              <span className="font-mono">{currency.currency}</span>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium">{formatCurrency(currency.profit)}</div>
                              <div className="text-xs text-muted-foreground">
                                Объем: {formatVolume(currency.volume)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Дневная динамика прибыли</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {profitData.dailyTrend.slice(-7).map((day) => (
                          <div key={day.date} className="flex items-center justify-between">
                            <span className="text-sm">
                              {format(new Date(day.date), 'dd.MM', { locale: ru })}
                            </span>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${day.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatCurrency(day.profit)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatVolume(day.volume)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    Данные о прибыли загружаются...
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}

        {/* Вкладка оборота */}
        <TabsContent value="turnover" className="space-y-4">
          {turnoverData ? (
            <>
              {/* Основные метрики оборота */}
              <Card>
                <CardHeader>
                  <CardTitle>Общий оборот</CardTitle>
                  <CardDescription>{turnoverData.period}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {formatCurrency(turnoverData.totalTurnover)}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle>По валютам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {turnoverData.currencies.slice(0, 5).map((currency) => (
                        <div key={currency.currency} className="flex items-center justify-between">
                          <span className="font-mono">{currency.currency}</span>
                          <div className="text-right">
                            <div className="text-sm font-medium">{formatCurrency(currency.turnover)}</div>
                            <div className="text-xs text-muted-foreground">
                              {currency.operationsCount} операций
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>По офисам</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {turnoverData.offices.slice(0, 5).map((office) => (
                        <div key={office.officeId} className="flex items-center justify-between">
                          <span className="text-sm">{office.officeName}</span>
                          <div className="text-sm font-medium">
                            {formatCurrency(office.turnover)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Топ клиентов</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {turnoverData.clients.slice(0, 5).map((client, index) => (
                        <div key={client.clientId} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                              {index + 1}
                            </div>
                            <span className="text-sm">{client.clientName}</span>
                          </div>
                          <div className="text-sm font-medium">
                            {formatCurrency(client.turnover)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Дневная динамика оборота</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {turnoverData.dailyTrend.slice(-14).map((day) => (
                      <div key={day.date} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                        <span className="text-sm">
                          {format(new Date(day.date), 'dd.MM.yyyy', { locale: ru })}
                        </span>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatCurrency(day.turnover)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {day.operationsCount} операций
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  Данные об обороте загружаются...
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
