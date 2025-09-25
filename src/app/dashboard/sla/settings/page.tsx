"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
import {
  Settings,
  Clock,
  AlertTriangle,
  Save,
  RefreshCw,
  Bell,
  Users,
  CheckCircle,
  Info
} from 'lucide-react'
import { OperationDirection, UserRole } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { toast } from 'sonner'

// Типы
interface SLARule {
  direction: OperationDirection
  baseTimeMinutes: number
  urgentThresholdAmount?: number
  urgentTimeMinutes?: number
  workingHoursOnly?: boolean
  escalationLevels?: {
    level: number
    timeMinutes: number
    notifyRoles: string[]
  }[]
}

const directionLabels = {
  [OperationDirection.CRYPTO_TO_CASH]: 'Крипта → Наличные',
  [OperationDirection.CASH_TO_CRYPTO]: 'Наличные → Крипта',
  [OperationDirection.CARD_TO_CRYPTO]: 'Карта → Крипта',
  [OperationDirection.CRYPTO_TO_CARD]: 'Крипта → Карта',
  [OperationDirection.CARD_TO_CASH]: 'Карта → Наличные',
  [OperationDirection.CASH_TO_CARD]: 'Наличные → Карта',
}

export default function SLASettingsPage() {
  const { user } = useAuth()
  const [slaRules, setSlaRules] = useState<Record<OperationDirection, SLARule>>({} as any)
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmailNotifications: true,
    enablePushNotifications: true,
    enableTelegramNotifications: false,
    reminderIntervalMinutes: 15,
    escalationEnabled: true,
    dailyReportEnabled: true,
    reportTime: '09:00'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Загрузка настроек
  useEffect(() => {
    loadSLASettings()
  }, [])

  const loadSLASettings = async () => {
    setLoading(true)
    try {
      // В реальном приложении здесь будет API запрос
      // Используем стандартные настройки
      const defaultRules: Record<OperationDirection, SLARule> = {
        [OperationDirection.CRYPTO_TO_CASH]: {
          direction: OperationDirection.CRYPTO_TO_CASH,
          baseTimeMinutes: 60,
          urgentThresholdAmount: 100000,
          urgentTimeMinutes: 30,
          workingHoursOnly: false,
          escalationLevels: [
            { level: 1, timeMinutes: 45, notifyRoles: ['CASHIER'] },
            { level: 2, timeMinutes: 75, notifyRoles: ['MANAGER'] },
            { level: 3, timeMinutes: 90, notifyRoles: ['ADMIN'] }
          ]
        },
        [OperationDirection.CASH_TO_CRYPTO]: {
          direction: OperationDirection.CASH_TO_CRYPTO,
          baseTimeMinutes: 45,
          urgentThresholdAmount: 500000,
          urgentTimeMinutes: 20,
          workingHoursOnly: false,
          escalationLevels: [
            { level: 1, timeMinutes: 30, notifyRoles: ['CASHIER'] },
            { level: 2, timeMinutes: 60, notifyRoles: ['MANAGER'] },
            { level: 3, timeMinutes: 75, notifyRoles: ['ADMIN'] }
          ]
        },
        [OperationDirection.CARD_TO_CRYPTO]: {
          direction: OperationDirection.CARD_TO_CRYPTO,
          baseTimeMinutes: 120,
          urgentThresholdAmount: 200000,
          urgentTimeMinutes: 60,
          workingHoursOnly: true,
          escalationLevels: [
            { level: 1, timeMinutes: 90, notifyRoles: ['CASHIER'] },
            { level: 2, timeMinutes: 150, notifyRoles: ['MANAGER'] },
            { level: 3, timeMinutes: 180, notifyRoles: ['ADMIN'] }
          ]
        },
        [OperationDirection.CRYPTO_TO_CARD]: {
          direction: OperationDirection.CRYPTO_TO_CARD,
          baseTimeMinutes: 90,
          urgentThresholdAmount: 300000,
          urgentTimeMinutes: 45,
          workingHoursOnly: true,
          escalationLevels: [
            { level: 1, timeMinutes: 60, notifyRoles: ['CASHIER'] },
            { level: 2, timeMinutes: 120, notifyRoles: ['MANAGER'] },
            { level: 3, timeMinutes: 150, notifyRoles: ['ADMIN'] }
          ]
        },
        [OperationDirection.CARD_TO_CASH]: {
          direction: OperationDirection.CARD_TO_CASH,
          baseTimeMinutes: 180,
          urgentThresholdAmount: 100000,
          urgentTimeMinutes: 120,
          workingHoursOnly: true,
          escalationLevels: [
            { level: 1, timeMinutes: 120, notifyRoles: ['CASHIER'] },
            { level: 2, timeMinutes: 240, notifyRoles: ['MANAGER'] },
            { level: 3, timeMinutes: 300, notifyRoles: ['ADMIN'] }
          ]
        },
        [OperationDirection.CASH_TO_CARD]: {
          direction: OperationDirection.CASH_TO_CARD,
          baseTimeMinutes: 240,
          urgentThresholdAmount: 150000,
          urgentTimeMinutes: 180,
          workingHoursOnly: true,
          escalationLevels: [
            { level: 1, timeMinutes: 180, notifyRoles: ['CASHIER'] },
            { level: 2, timeMinutes: 300, notifyRoles: ['MANAGER'] },
            { level: 3, timeMinutes: 360, notifyRoles: ['ADMIN'] }
          ]
        }
      }

      setSlaRules(defaultRules)
    } catch (error) {
      console.error('Failed to load SLA settings:', error)
      toast.error('Ошибка загрузки настроек SLA')
    } finally {
      setLoading(false)
    }
  }

  const saveSLASettings = async () => {
    setSaving(true)
    try {
      // В реальном приложении здесь будет API запрос для сохранения
      await new Promise(resolve => setTimeout(resolve, 1000)) // Имитация сохранения
      
      toast.success('Настройки SLA успешно сохранены')
    } catch (error) {
      console.error('Failed to save SLA settings:', error)
      toast.error('Ошибка сохранения настроек SLA')
    } finally {
      setSaving(false)
    }
  }

  const updateRule = (direction: OperationDirection, field: keyof SLARule, value: any) => {
    setSlaRules(prev => ({
      ...prev,
      [direction]: {
        ...prev[direction],
        [field]: value
      }
    }))
  }

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    
    if (hours === 0) return `${mins}м`
    if (mins === 0) return `${hours}ч`
    
    return `${hours}ч ${mins}м`
  }

  // Проверяем права доступа
  if (!user || user.role !== UserRole.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Недостаточно прав</h2>
          <p className="text-muted-foreground">
            У вас нет прав доступа к настройкам SLA
          </p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-6 max-w-full">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Настройки SLA</h1>
          <p className="text-muted-foreground">
            Управление правилами и уведомлениями SLA мониторинга
          </p>
        </div>
        <Button onClick={saveSLASettings} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Сохранить настройки
        </Button>
      </div>

      <Tabs defaultValue="rules" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rules" className="gap-2">
            <Clock className="h-4 w-4" />
            SLA Правила
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            Уведомления
          </TabsTrigger>
          <TabsTrigger value="escalation" className="gap-2">
            <Users className="h-4 w-4" />
            Эскалация
          </TabsTrigger>
        </TabsList>

        {/* Вкладка: SLA Правила */}
        <TabsContent value="rules" className="space-y-6">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Настройте временные рамки SLA для различных типов операций. 
              Срочные операции имеют сокращенные временные рамки для крупных сумм.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6">
            {Object.entries(slaRules).map(([direction, rule]) => (
              <Card key={direction}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {directionLabels[direction as OperationDirection]}
                  </CardTitle>
                  <CardDescription>
                    Временные рамки и правила эскалации для данного типа операций
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Базовое время */}
                    <div className="space-y-2">
                      <Label htmlFor={`base-${direction}`}>Базовое время (мин)</Label>
                      <Input
                        id={`base-${direction}`}
                        type="number"
                        value={rule.baseTimeMinutes}
                        onChange={(e) => updateRule(direction as OperationDirection, 'baseTimeMinutes', parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>

                    {/* Порог срочности */}
                    <div className="space-y-2">
                      <Label htmlFor={`threshold-${direction}`}>Порог срочности (₽)</Label>
                      <Input
                        id={`threshold-${direction}`}
                        type="number"
                        value={rule.urgentThresholdAmount || ''}
                        onChange={(e) => updateRule(direction as OperationDirection, 'urgentThresholdAmount', parseInt(e.target.value) || undefined)}
                        placeholder="Не установлено"
                        className="w-full"
                      />
                    </div>

                    {/* Срочное время */}
                    <div className="space-y-2">
                      <Label htmlFor={`urgent-${direction}`}>Срочное время (мин)</Label>
                      <Input
                        id={`urgent-${direction}`}
                        type="number"
                        value={rule.urgentTimeMinutes || ''}
                        onChange={(e) => updateRule(direction as OperationDirection, 'urgentTimeMinutes', parseInt(e.target.value) || undefined)}
                        placeholder="Не установлено"
                        className="w-full"
                      />
                    </div>

                    {/* Рабочие часы */}
                    <div className="space-y-2">
                      <Label htmlFor={`working-${direction}`}>Только рабочее время</Label>
                      <div className="flex items-center pt-2">
                        <Switch
                          id={`working-${direction}`}
                          checked={rule.workingHoursOnly || false}
                          onCheckedChange={(checked) => updateRule(direction as OperationDirection, 'workingHoursOnly', checked)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Статус карточка */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-sm font-medium">{formatTime(rule.baseTimeMinutes)}</div>
                      <div className="text-xs text-muted-foreground">Стандартно</div>
                    </div>
                    {rule.urgentTimeMinutes && (
                      <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                        <div className="text-sm font-medium text-orange-600">{formatTime(rule.urgentTimeMinutes)}</div>
                        <div className="text-xs text-orange-500">Срочно</div>
                      </div>
                    )}
                    <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                      <div className="text-sm font-medium text-green-600">{rule.escalationLevels?.length || 0}</div>
                      <div className="text-xs text-green-500">Уровней эскалации</div>
                    </div>
                    <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                      <div className="text-sm font-medium text-blue-600">{rule.workingHoursOnly ? 'Да' : 'Нет'}</div>
                      <div className="text-xs text-blue-500">Рабочие часы</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Вкладка: Уведомления */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Настройки уведомлений</CardTitle>
              <CardDescription>
                Управление способами и частотой уведомлений SLA
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Типы уведомлений</h4>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email-notifications">Email уведомления</Label>
                      <p className="text-sm text-muted-foreground">Отправка на корпоративную почту</p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notificationSettings.enableEmailNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, enableEmailNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="push-notifications">Push уведомления</Label>
                      <p className="text-sm text-muted-foreground">Браузерные уведомления</p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={notificationSettings.enablePushNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, enablePushNotifications: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="telegram-notifications">Telegram уведомления</Label>
                      <p className="text-sm text-muted-foreground">Отправка в Telegram чат</p>
                    </div>
                    <Switch
                      id="telegram-notifications"
                      checked={notificationSettings.enableTelegramNotifications}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, enableTelegramNotifications: checked }))}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium">Частота и отчеты</h4>

                  <div className="space-y-2">
                    <Label htmlFor="reminder-interval">Интервал напоминаний (мин)</Label>
                    <Input
                      id="reminder-interval"
                      type="number"
                      value={notificationSettings.reminderIntervalMinutes}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, reminderIntervalMinutes: parseInt(e.target.value) }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="escalation-enabled">Эскалация включена</Label>
                      <p className="text-sm text-muted-foreground">Автоматическая эскалация по уровням</p>
                    </div>
                    <Switch
                      id="escalation-enabled"
                      checked={notificationSettings.escalationEnabled}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, escalationEnabled: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="daily-report">Ежедневные отчеты</Label>
                      <p className="text-sm text-muted-foreground">Отправка сводки в начале дня</p>
                    </div>
                    <Switch
                      id="daily-report"
                      checked={notificationSettings.dailyReportEnabled}
                      onCheckedChange={(checked) => setNotificationSettings(prev => ({ ...prev, dailyReportEnabled: checked }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="report-time">Время отчета</Label>
                    <Input
                      id="report-time"
                      type="time"
                      value={notificationSettings.reportTime}
                      onChange={(e) => setNotificationSettings(prev => ({ ...prev, reportTime: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Вкладка: Эскалация */}
        <TabsContent value="escalation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Матрица эскалации</CardTitle>
              <CardDescription>
                Настройка уровней эскалации и ответственных ролей
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип операции</TableHead>
                    <TableHead>Уровень 1</TableHead>
                    <TableHead>Уровень 2</TableHead>
                    <TableHead>Уровень 3</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(slaRules).map(([direction, rule]) => (
                    <TableRow key={direction}>
                      <TableCell className="font-medium">
                        {directionLabels[direction as OperationDirection]}
                      </TableCell>
                      {[1, 2, 3].map(level => {
                        const escalation = rule.escalationLevels?.find(e => e.level === level)
                        return (
                          <TableCell key={level}>
                            {escalation ? (
                              <div className="space-y-1">
                                <div className="text-sm font-medium">{formatTime(escalation.timeMinutes)}</div>
                                <div className="flex gap-1">
                                  {escalation.notifyRoles.map(role => (
                                    <Badge key={role} variant="outline" className="text-xs">
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Не настроено</span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm text-green-600">Активно</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Статистика эскалации */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Эскалаций за 24ч</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">12</div>
                <p className="text-xs text-muted-foreground">+3 к вчерашнему дню</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Средний уровень</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">1.8</div>
                <p className="text-xs text-muted-foreground">Уровень эскалации</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Время разрешения</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2.5ч</div>
                <p className="text-xs text-muted-foreground">После эскалации</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

