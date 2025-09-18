'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, AlertTriangle, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { exchangeRateCreateSchema, type ExchangeRateCreateInput, type ExchangeRateData, type CurrencyData } from '@/lib/types'

export default function ExchangeRatesPage() {
  const [exchangeRates, setExchangeRates] = useState<ExchangeRateData[]>([])
  const [currencies, setCurrencies] = useState<CurrencyData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false)
  const [editingRate, setEditingRate] = useState<ExchangeRateData | null>(null)
  const [missingRates, setMissingRates] = useState<CurrencyData[]>([])
  const [bulkRates, setBulkRates] = useState<Record<string, {purchaseRate: number, defaultMargin: number}>>({})

  const form = useForm<ExchangeRateCreateInput>({
    resolver: zodResolver(exchangeRateCreateSchema),
    defaultValues: {
      currencyId: '',
      purchaseRate: 0,
      defaultMargin: 1.0,
      rateDate: new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
    }
  })

  const fetchData = async () => {
    try {
      const [ratesRes, currenciesRes] = await Promise.all([
        fetch(`/api/exchange-rates?latest=true`),
        fetch('/api/currencies?isActive=true')
      ])

      const [ratesResult, currenciesResult] = await Promise.all([
        ratesRes.json(),
        currenciesRes.json()
      ])

      if (ratesResult.success) setExchangeRates(ratesResult.data)
      if (currenciesResult.success) {
        setCurrencies(currenciesResult.data)
        
        // Находим валюты без курсов на текущую дату
        const ratesMap = new Set(ratesResult.data?.map((r: ExchangeRateData) => r.currencyId) || [])
        const missing = currenciesResult.data.filter((c: CurrencyData) => !ratesMap.has(c.id))
        setMissingRates(missing)
      }
    } catch (error) {
      toast.error('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  const fetchRatesByDate = async (date: string) => {
    try {
      const response = await fetch(`/api/exchange-rates?rateDate=${date}`)
      const result = await response.json()
      
      if (result.success) {
        setExchangeRates(result.data)
      }
    } catch (error) {
      toast.error('Ошибка загрузки курсов')
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (selectedDate) {
      fetchRatesByDate(selectedDate)
    }
  }, [selectedDate])

  const onSubmit = async (data: ExchangeRateCreateInput) => {
    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          rateDate: selectedDate + 'T00:00:00.000Z'
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsCreateDialogOpen(false)
        setEditingRate(null)
        form.reset()
        fetchRatesByDate(selectedDate)
        fetchData() // Обновляем для проверки недостающих курсов
      } else {
        toast.error(result.error || 'Ошибка сохранения курса')
      }
    } catch (error) {
      toast.error('Ошибка сохранения курса')
    }
  }

  const handleBulkUpdate = async () => {
    // Собираем только валюты с заполненными курсами
    const ratesToUpdate = missingRates
      .filter(currency => {
        const rateData = bulkRates[currency.id]
        return rateData && rateData.purchaseRate > 0
      })
      .map(currency => {
        const rateData = bulkRates[currency.id]
        return {
          currencyId: currency.id,
          purchaseRate: rateData.purchaseRate,
          defaultMargin: rateData.defaultMargin || 1.0
        }
      })

    if (ratesToUpdate.length === 0) {
      toast.error('Необходимо заполнить хотя бы один курс')
      return
    }

    try {
      const response = await fetch('/api/exchange-rates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rates: ratesToUpdate,
          rateDate: selectedDate
        })
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsBulkDialogOpen(false)
        setBulkRates({}) // Очищаем состояние
        fetchRatesByDate(selectedDate)
        fetchData() // Обновляем для проверки недостающих курсов
      } else {
        toast.error(result.error || 'Ошибка массового обновления курсов')
      }
    } catch (error) {
      toast.error('Ошибка массового обновления курсов')
    }
  }

  const handleEdit = (rate: ExchangeRateData) => {
    setEditingRate(rate)
    form.reset({
      currencyId: rate.currencyId,
      purchaseRate: rate.purchaseRate,
      defaultMargin: rate.defaultMargin,
      rateDate: selectedDate + 'T00:00:00.000Z'
    })
    setIsCreateDialogOpen(true)
  }

  const handleCreateMissingRate = (currency: CurrencyData) => {
    form.reset({
      currencyId: currency.id,
      purchaseRate: 0,
      defaultMargin: 1.0,
      rateDate: selectedDate + 'T00:00:00.000Z'
    })
    setIsCreateDialogOpen(true)
  }

  const filteredRates = exchangeRates.filter(rate =>
    selectedCurrency === 'all' || rate.currencyId === selectedCurrency
  )

  const formatRate = (rate: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    }).format(rate)
  }

  const calculateInverseRate = (purchaseRate: number, margin: number) => {
    const sellRate = purchaseRate * (1 + margin / 100)
    return {
      purchaseRate: 1 / sellRate,
      sellRate: 1 / purchaseRate
    }
  }

  const isReverseCurrency = (currency: string) => {
    // Определяем, какие валюты показывать как обратные курсы
    const reverseCurrencies = ['USD', 'EUR', 'TRY', 'RUB']
    return reverseCurrencies.includes(currency)
  }

  const isToday = selectedDate === new Date().toISOString().split('T')[0]
  const isFuture = new Date(selectedDate) > new Date()

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-6 max-w-full">
      <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Курсы валют</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Управление курсами валют для операций обмена
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isToday && missingRates.length > 0 && (
            <Button variant="outline" onClick={() => setIsBulkDialogOpen(true)} className="w-full sm:w-auto">
              Массовое обновление
            </Button>
          )}
          <Dialog 
            open={isCreateDialogOpen} 
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open)
              if (!open) {
                setEditingRate(null)
                form.reset()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Установить курс
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingRate ? 'Редактировать курс' : 'Установить курс'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="currencyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Валюта</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                          disabled={!!editingRate}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите валюту" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies.map((currency) => (
                              <SelectItem key={currency.id} value={currency.id}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="purchaseRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Курс закупки</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.00000001"
                            placeholder="0.00000000"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultMargin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Маржа по умолчанию (%)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            placeholder="1.00"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="text-sm text-muted-foreground">
                    Дата курса: {new Date(selectedDate).toLocaleDateString('ru-RU')}
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit">
                      {editingRate ? 'Сохранить' : 'Установить'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Предупреждения */}
      {isToday && missingRates.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Не установлены курсы для {missingRates.length} валют на сегодня: {' '}
            {missingRates.map(c => c.code).join(', ')}
          </AlertDescription>
        </Alert>
      )}

      {isFuture && (
        <Alert>
          <Calendar className="h-4 w-4" />
          <AlertDescription>
            Вы просматриваете курсы на будущую дату: {new Date(selectedDate).toLocaleDateString('ru-RU')}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="date" className="text-sm font-medium">Дата курса</label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="currency" className="text-sm font-medium">Валюта</label>
              <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Все валюты" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все валюты</SelectItem>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.code} - {currency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <>
              {/* Недостающие курсы */}
              {isToday && missingRates.length > 0 && (
                <Alert className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="space-y-3">
                    <div>
                      Требуется установить курсы для {missingRates.length} валют на сегодня
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {missingRates.map((currency) => (
                        <div key={currency.id} className="flex items-center justify-between p-3 bg-background rounded-md border">
                          <div className="flex flex-col">
                            <span className="font-mono font-semibold">{currency.code}</span>
                            <span className="text-xs text-muted-foreground">{currency.name}</span>
                          </div>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleCreateMissingRate(currency)}
                          >
                            Установить
                          </Button>
                        </div>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Валюта</TableHead>
                    <TableHead className="text-right">Покупка</TableHead>
                    <TableHead className="text-right">Продажа</TableHead>
                    <TableHead className="text-right">Обратный курс</TableHead>
                    <TableHead className="text-right">Маржа (%)</TableHead>
                    <TableHead>Установлен</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRates.map((rate) => {
                    const inverseRates = calculateInverseRate(rate.purchaseRate, rate.defaultMargin)
                    return (
                      <TableRow key={rate.id}>
                        <TableCell>
                          <div>
                            <div className="font-mono font-semibold">{rate.currency?.code}</div>
                            <div className="text-sm text-muted-foreground">
                              {rate.currency?.name}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div>{formatRate(rate.purchaseRate)}</div>
                          <div className="text-xs text-muted-foreground">
                            1 {rate.currency?.code} = {formatRate(rate.purchaseRate)} USDT
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <div>{formatRate(rate.sellRate)}</div>
                          <div className="text-xs text-muted-foreground">
                            За продажу 1 {rate.currency?.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          <div>{formatRate(inverseRates.purchaseRate)}</div>
                          <div className="text-xs text-muted-foreground">
                            1 USDT = {formatRate(inverseRates.purchaseRate)} {rate.currency?.code}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">
                            {rate.defaultMargin}%
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">{rate.setter?.firstName} {rate.setter?.lastName}</div>
                            <div className="text-muted-foreground">
                              {new Date(rate.createdAt).toLocaleDateString('ru-RU')} {' '}
                              {new Date(rate.createdAt).toLocaleTimeString('ru-RU', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={rate.isActive ? 'default' : 'secondary'}>
                            {rate.isActive ? 'Активен' : 'Неактивен'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(rate)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                  {filteredRates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Курсы валют на выбранную дату не найдены
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Диалог массового обновления */}
      <Dialog 
        open={isBulkDialogOpen} 
        onOpenChange={(open) => {
          setIsBulkDialogOpen(open)
          if (!open) {
            setBulkRates({}) // Очищаем состояние при закрытии
          }
        }}
      >
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Массовое обновление курсов
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Установите курсы для всех недостающих валют на <strong>{new Date(selectedDate).toLocaleDateString('ru-RU')}</strong>. 
                Рекомендуется заполнить все поля перед сохранением.
              </AlertDescription>
            </Alert>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Валюта</TableHead>
                    <TableHead className="text-right">Курс закупки</TableHead>
                    <TableHead className="text-right">Маржа (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {missingRates.map((currency, index) => (
                    <TableRow key={currency.id}>
                      <TableCell>
                        <div>
                          <div className="font-mono font-semibold">{currency.code}</div>
                          <div className="text-sm text-muted-foreground">{currency.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.00000001"
                          placeholder="0.00000000"
                          value={bulkRates[currency.id]?.purchaseRate || ''}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 0
                            setBulkRates(prev => ({
                              ...prev,
                              [currency.id]: {
                                ...prev[currency.id],
                                purchaseRate: value,
                                defaultMargin: prev[currency.id]?.defaultMargin || 1.0
                              }
                            }))
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="1.00"
                          value={bulkRates[currency.id]?.defaultMargin || 1.0}
                          onChange={(e) => {
                            const value = parseFloat(e.target.value) || 1.0
                            setBulkRates(prev => ({
                              ...prev,
                              [currency.id]: {
                                ...prev[currency.id],
                                purchaseRate: prev[currency.id]?.purchaseRate || 0,
                                defaultMargin: value
                              }
                            }))
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsBulkDialogOpen(false)
                  setBulkRates({})
                }}
              >
                Отмена
              </Button>
              <Button 
                onClick={handleBulkUpdate} 
                className="bg-primary hover:bg-primary/90"
                disabled={Object.keys(bulkRates).length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Сохранить курсы ({Object.keys(bulkRates).filter(id => bulkRates[id]?.purchaseRate > 0).length})
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
