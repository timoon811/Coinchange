'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Calendar, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { 
  depositCreateSchema, 
  type DepositCreateInput, 
  type DepositData, 
  type CurrencyData
} from '@/lib/types'
import { DepositType } from '@prisma/client'

interface Office {
  id: string
  name: string
}

interface Client {
  id: string
  firstName?: string
  lastName?: string
  username?: string
}

export default function DepositsPage() {
  const [deposits, setDeposits] = useState<DepositData[]>([])
  const [currencies, setCurrencies] = useState<CurrencyData[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedOffice, setSelectedOffice] = useState<string>('all')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, total: 0 })
  const [expiringDeposits, setExpiringDeposits] = useState<DepositData[]>([])

  const form = useForm<DepositCreateInput>({
    resolver: zodResolver(depositCreateSchema),
    defaultValues: {
      type: DepositType.OWNER,
      clientId: undefined,
      officeId: '',
      currencyId: '',
      amount: 0,
      interestRate: undefined,
      term: undefined,
      startDate: undefined,
      endDate: undefined,
      description: '',
      notes: ''
    }
  })

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
        ...(selectedType !== 'all' && { type: selectedType }),
        ...(selectedOffice !== 'all' && { officeId: selectedOffice }),
        ...(selectedCurrency !== 'all' && { currencyId: selectedCurrency })
      })

      const [depositsRes, currenciesRes, officesRes, clientsRes, expiringRes] = await Promise.all([
        fetch(`/api/deposits?${params}`),
        fetch('/api/currencies?isActive=true'),
        fetch('/api/admin/offices'),
        fetch('/api/clients'),
        fetch('/api/deposits?expiringDays=30&isActive=true')
      ])

      const [depositsResult, currenciesResult, officesResult, clientsResult, expiringResult] = await Promise.all([
        depositsRes.json(),
        currenciesRes.json(),
        officesRes.json(),
        clientsRes.json(),
        expiringRes.json()
      ])

      if (depositsResult.success) {
        setDeposits(depositsResult.data?.deposits || [])
        setPagination(prev => ({ ...prev, total: depositsResult.data?.total || 0 }))
      }
      if (currenciesResult.success) setCurrencies(currenciesResult.data || [])
      if (officesResult.success) setOffices(officesResult.data?.offices || [])
      if (clientsResult.success) setClients(clientsResult.data?.clients || [])
      if (expiringResult.success) setExpiringDeposits(expiringResult.data?.deposits || [])
    } catch (error) {
      toast.error('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [pagination.page, selectedType, selectedOffice, selectedCurrency])

  const onSubmit = async (data: DepositCreateInput) => {
    try {
      const response = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsCreateDialogOpen(false)
        form.reset()
        fetchData()
      } else {
        toast.error(result.error || 'Ошибка создания депозита')
      }
    } catch (error) {
      toast.error('Ошибка создания депозита')
    }
  }

  const getDepositTypeLabel = (type: DepositType) => {
    switch (type) {
      case DepositType.OWNER:
        return 'Собственник'
      case DepositType.CLIENT:
        return 'Клиент'
      default:
        return type
    }
  }

  const getDepositTypeBadgeColor = (type: DepositType) => {
    switch (type) {
      case DepositType.OWNER:
        return 'bg-blue-100 text-blue-800'
      case DepositType.CLIENT:
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatAmount = (amount: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(amount)
  }

  const getDaysUntilExpiry = (endDate: string) => {
    const today = new Date()
    const expiry = new Date(endDate)
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getExpiryStatus = (endDate?: string) => {
    if (!endDate) return null
    
    const daysLeft = getDaysUntilExpiry(endDate)
    
    if (daysLeft < 0) {
      return { text: 'Просрочен', color: 'text-red-600' }
    } else if (daysLeft <= 7) {
      return { text: `${daysLeft} дней`, color: 'text-orange-600' }
    } else if (daysLeft <= 30) {
      return { text: `${daysLeft} дней`, color: 'text-yellow-600' }
    }
    
    return { text: `${daysLeft} дней`, color: 'text-green-600' }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Депозиты</h1>
          <p className="text-muted-foreground">
            Управление депозитами собственника и клиентов
          </p>
        </div>
        <Dialog 
          open={isCreateDialogOpen} 
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            if (!open) {
              form.reset()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Новый депозит
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Создать депозит</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип депозита</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={DepositType.OWNER}>Депозит собственника</SelectItem>
                            <SelectItem value={DepositType.CLIENT}>Депозит клиента</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="officeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Офис</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите офис" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {offices && Array.isArray(offices) ? offices.map((office) => (
                              <SelectItem key={office.id} value={office.id}>
                                {office.name}
                              </SelectItem>
                            )) : null}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch('type') === DepositType.CLIENT && (
                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Клиент</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите клиента" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {clients && Array.isArray(clients) ? clients.map((client) => (
                              <SelectItem key={client.id} value={client.id}>
                                {[client.firstName, client.lastName].filter(Boolean).join(' ') || client.username || 'Неизвестный клиент'}
                              </SelectItem>
                            )) : null}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="currencyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Валюта</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите валюту" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {currencies && Array.isArray(currencies) ? currencies.map((currency) => (
                              <SelectItem key={currency.id} value={currency.id}>
                                {currency.code} - {currency.name}
                              </SelectItem>
                            )) : null}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Сумма</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.00000001"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="interestRate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Процентная ставка (% годовых, опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.01"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="term"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Срок (дней, опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата начала (опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дата окончания (опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value || undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание (опционально)</FormLabel>
                      <FormControl>
                        <Input placeholder="Краткое описание депозита..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Заметки (опционально)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Дополнительная информация..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit">
                    Создать депозит
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Предупреждение об истекающих депозитах */}
      {expiringDeposits && Array.isArray(expiringDeposits) && expiringDeposits.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {expiringDeposits.length} депозитов истекает в ближайшие 30 дней
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Тип депозита" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value={DepositType.OWNER}>Собственник</SelectItem>
                <SelectItem value={DepositType.CLIENT}>Клиент</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Офис" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все офисы</SelectItem>
                {offices && Array.isArray(offices) ? offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                )) : null}
              </SelectContent>
            </Select>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Валюта" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все валюты</SelectItem>
                {currencies && Array.isArray(currencies) ? currencies.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.code}
                  </SelectItem>
                )) : null}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Тип/Клиент</TableHead>
                    <TableHead>Офис</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Валюта</TableHead>
                    <TableHead>Ставка</TableHead>
                    <TableHead>Период</TableHead>
                    <TableHead>До окончания</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deposits && Array.isArray(deposits) ? deposits.map((deposit) => {
                    const expiryStatus = getExpiryStatus(deposit.endDate?.toString())
                    return (
                      <TableRow key={deposit.id}>
                        <TableCell>
                          <div>
                            <Badge className={getDepositTypeBadgeColor(deposit.type)}>
                              {getDepositTypeLabel(deposit.type)}
                            </Badge>
                            {deposit.client && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {[deposit.client.firstName, deposit.client.lastName]
                                  .filter(Boolean)
                                  .join(' ') || deposit.client.username || 'Неизвестный клиент'}
                              </div>
                            )}
                            {deposit.description && (
                              <div className="text-sm text-muted-foreground mt-1">
                                {deposit.description}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{deposit.office?.name}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatAmount(Number(deposit.amount), deposit.currency?.decimals)}
                        </TableCell>
                        <TableCell className="font-mono">
                          {deposit.currency?.code}
                        </TableCell>
                        <TableCell>
                          {deposit.interestRate ? `${deposit.interestRate}%` : '—'}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>
                              {new Date(deposit.startDate).toLocaleDateString('ru-RU')}
                            </div>
                            {deposit.endDate && (
                              <div className="text-muted-foreground">
                                до {new Date(deposit.endDate).toLocaleDateString('ru-RU')}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {expiryStatus ? (
                            <span className={expiryStatus.color}>
                              {expiryStatus.text}
                            </span>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={deposit.isActive ? 'default' : 'secondary'}>
                            {deposit.isActive ? 'Активен' : 'Неактивен'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  }) : null}
                  {(!deposits || deposits.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Депозиты не найдены
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Пагинация */}
              {pagination.total > 20 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-muted-foreground">
                    Показано {deposits ? deposits.length : 0} из {pagination.total} депозитов
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagination.page === 1}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    >
                      Назад
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deposits.length < 20}
                      onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    >
                      Далее
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
