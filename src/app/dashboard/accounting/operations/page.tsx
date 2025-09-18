'use client'

import { useState, useEffect } from 'react'
import { Plus, Search, Filter, Calendar, ArrowUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { 
  operationCreateSchema, 
  type OperationCreateInput, 
  type OperationData, 
  type CurrencyData,
  type AccountData
} from '@/lib/types'
import { OperationType } from '@prisma/client'

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

interface Category {
  id: string
  name: string
  type: string
}

export default function OperationsPage() {
  const [operations, setOperations] = useState<OperationData[]>([])
  const [currencies, setCurrencies] = useState<CurrencyData[]>([])
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOffice, setSelectedOffice] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedCurrency, setSelectedCurrency] = useState<string>('all')
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, total: 0 })

  const form = useForm<OperationCreateInput>({
    resolver: zodResolver(operationCreateSchema),
    defaultValues: {
      officeId: '',
      type: OperationType.EXCHANGE,
      amount: 0,
      currencyId: '',
      fromAccountId: undefined,
      toAccountId: undefined,
      exchangeRate: undefined,
      requestId: undefined,
      clientId: undefined,
      categoryId: undefined,
      description: '',
      notes: ''
    }
  })

  const fetchData = async () => {
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: '20',
        ...(selectedOffice !== 'all' && { officeId: selectedOffice }),
        ...(selectedType !== 'all' && { type: selectedType }),
        ...(selectedCurrency !== 'all' && { currencyId: selectedCurrency }),
        ...(searchTerm && { search: searchTerm })
      })

      const [operationsRes, currenciesRes, accountsRes, officesRes, clientsRes] = await Promise.all([
        fetch(`/api/operations?${params}`),
        fetch('/api/currencies?isActive=true'),
        fetch('/api/accounts?isActive=true'),
        fetch('/api/admin/offices'),
        fetch('/api/clients')
      ])

      const [operationsResult, currenciesResult, accountsResult, officesResult, clientsResult] = await Promise.all([
        operationsRes.json(),
        currenciesRes.json(),
        accountsRes.json(),
        officesRes.json(),
        clientsRes.json()
      ])

      if (operationsResult.success) {
        setOperations(operationsResult.data.operations || [])
        setPagination(prev => ({ ...prev, total: operationsResult.data.total || 0 }))
      }
      if (currenciesResult.success) setCurrencies(Array.isArray(currenciesResult.data) ? currenciesResult.data : [])
      if (accountsResult.success) setAccounts(Array.isArray(accountsResult.data) ? accountsResult.data : [])
      if (officesResult.success) setOffices(Array.isArray(officesResult.data?.offices) ? officesResult.data.offices : [])
      if (clientsResult.success) setClients(Array.isArray(clientsResult.data?.clients) ? clientsResult.data.clients : [])
    } catch (error) {
      console.error('Ошибка загрузки данных операций:', error)
      toast.error('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [pagination.page, selectedOffice, selectedType, selectedCurrency])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
      fetchData()
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const onSubmit = async (data: OperationCreateInput) => {
    try {
      const response = await fetch('/api/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsCreateSheetOpen(false)
        form.reset()
        fetchData()
      } else {
        toast.error(result.error || 'Ошибка создания операции')
      }
    } catch (error) {
      toast.error('Ошибка создания операции')
    }
  }

  const getOperationTypeLabel = (type: OperationType) => {
    switch (type) {
      case OperationType.EXCHANGE:
        return 'Обмен'
      case OperationType.DEPOSIT:
        return 'Ввод'
      case OperationType.WITHDRAWAL:
        return 'Вывод'
      case OperationType.TRANSFER:
        return 'Перевод'
      case OperationType.ADJUSTMENT:
        return 'Корректировка'
      default:
        return type
    }
  }

  const getOperationTypeBadgeColor = (type: OperationType) => {
    switch (type) {
      case OperationType.EXCHANGE:
        return 'bg-blue-100 text-blue-800'
      case OperationType.DEPOSIT:
        return 'bg-green-100 text-green-800'
      case OperationType.WITHDRAWAL:
        return 'bg-red-100 text-red-800'
      case OperationType.TRANSFER:
        return 'bg-yellow-100 text-yellow-800'
      case OperationType.ADJUSTMENT:
        return 'bg-gray-100 text-gray-800'
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

  const selectedOfficeAccounts = accounts.filter(account => 
    form.watch('officeId') ? account.officeId === form.watch('officeId') : false
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Операции</h1>
        <Sheet 
          open={isCreateSheetOpen} 
          onOpenChange={(open) => {
            setIsCreateSheetOpen(open)
            if (!open) {
              form.reset()
            }
          }}
        >
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Новая операция
            </Button>
          </SheetTrigger>
          <SheetContent className="w-[90vw] sm:w-[600px] lg:w-[800px] sm:max-w-[800px] overflow-y-auto" side="right">
            <SheetHeader>
              <SheetTitle>Создать операцию</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                            {offices.map((office) => (
                              <SelectItem key={office.id} value={office.id}>
                                {office.name}
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
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип операции</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={OperationType.EXCHANGE}>Обмен</SelectItem>
                            <SelectItem value={OperationType.DEPOSIT}>Ввод</SelectItem>
                            <SelectItem value={OperationType.WITHDRAWAL}>Вывод</SelectItem>
                            <SelectItem value={OperationType.TRANSFER}>Перевод</SelectItem>
                            <SelectItem value={OperationType.ADJUSTMENT}>Корректировка</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FormField
                      control={form.control}
                      name="fromAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Счет списания (опционально)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите счет" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedOfficeAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} ({account.currency?.code})
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
                      name="toAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Счет зачисления (опционально)</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите счет" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {selectedOfficeAccounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name} ({account.currency?.code})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="clientId"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-1">
                        <FormLabel>Клиент (опционально)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите клиента" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clients.map((client) => (
                            <SelectItem key={client.id} value={client.id}>
                              {[client.firstName, client.lastName].filter(Boolean).join(' ') || client.username || 'Неизвестный клиент'}
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
                    name="description"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Описание</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Краткое описание операции..." rows={3} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem className="lg:col-span-2">
                        <FormLabel>Заметки (опционально)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Дополнительная информация..." rows={2} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="lg:col-span-2 flex flex-col sm:flex-row justify-end space-y-2 sm:space-y-0 sm:space-x-3 pt-6 mt-6 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsCreateSheetOpen(false)}
                      className="w-full sm:w-24"
                    >
                      Отмена
                    </Button>
                    <Button type="submit" className="w-full sm:w-32">
                      Создать операцию
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск операций..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={selectedOffice} onValueChange={setSelectedOffice}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Офис" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все офисы</SelectItem>
                {offices.map((office) => (
                  <SelectItem key={office.id} value={office.id}>
                    {office.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Тип операции" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все типы</SelectItem>
                <SelectItem value={OperationType.EXCHANGE}>Обмен</SelectItem>
                <SelectItem value={OperationType.DEPOSIT}>Ввод</SelectItem>
                <SelectItem value={OperationType.WITHDRAWAL}>Вывод</SelectItem>
                <SelectItem value={OperationType.TRANSFER}>Перевод</SelectItem>
                <SelectItem value={OperationType.ADJUSTMENT}>Корректировка</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedCurrency} onValueChange={setSelectedCurrency}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Валюта" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все валюты</SelectItem>
                {currencies.map((currency) => (
                  <SelectItem key={currency.id} value={currency.id}>
                    {currency.code}
                  </SelectItem>
                ))}
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
                    <TableHead>Дата/Время</TableHead>
                    <TableHead>Тип</TableHead>
                    <TableHead>Описание</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                    <TableHead>Валюта</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Исполнитель</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operations.map((operation) => (
                    <TableRow key={operation.id}>
                      <TableCell>
                        <div className="text-sm">
                          <div>{new Date(operation.createdAt).toLocaleDateString('ru-RU')}</div>
                          <div className="text-muted-foreground">
                            {new Date(operation.createdAt).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getOperationTypeBadgeColor(operation.type)}>
                          {getOperationTypeLabel(operation.type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{operation.description}</div>
                          {operation.notes && (
                            <div className="text-sm text-muted-foreground">
                              {operation.notes}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatAmount(Number(operation.amount), operation.currency?.decimals)}
                      </TableCell>
                      <TableCell className="font-mono">
                        {operation.currency?.code}
                      </TableCell>
                      <TableCell>
                        {operation.client ? (
                          <div className="text-sm">
                            {[operation.client.firstName, operation.client.lastName]
                              .filter(Boolean)
                              .join(' ') || operation.client.username || 'Неизвестный клиент'}
                          </div>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {operation.performer?.firstName} {operation.performer?.lastName}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {operations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        Операции не найдены
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {/* Пагинация */}
              {pagination.total > 20 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-muted-foreground">
                    Показано {operations.length} из {pagination.total} операций
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
                      disabled={operations.length < 20}
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
