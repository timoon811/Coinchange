'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { accountCreateSchema, type AccountCreateInput, type AccountData, type CurrencyData } from '@/lib/types'
import { AccountType } from '@prisma/client'

interface Office {
  id: string
  name: string
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [currencies, setCurrencies] = useState<CurrencyData[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedOffice, setSelectedOffice] = useState<string>('all')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<AccountData | null>(null)
  const [adjustingAccount, setAdjustingAccount] = useState<AccountData | null>(null)

  const form = useForm<AccountCreateInput>({
    resolver: zodResolver(accountCreateSchema),
    defaultValues: {
      officeId: '',
      currencyId: '',
      type: AccountType.CASH,
      name: '',
      description: '',
      initialBalance: 0,
      minBalance: undefined,
      maxBalance: undefined
    }
  })

  const adjustForm = useForm<{ amount: number; description: string }>({
    defaultValues: {
      amount: 0,
      description: ''
    }
  })

  const fetchData = async () => {
    try {
      const [accountsRes, currenciesRes, officesRes] = await Promise.all([
        fetch('/api/accounts'),
        fetch('/api/currencies?isActive=true'),
        fetch('/api/admin/offices')
      ])

      const [accountsResult, currenciesResult, officesResult] = await Promise.all([
        accountsRes.json(),
        currenciesRes.json(),
        officesRes.json()
      ])

      if (accountsResult.success) setAccounts(accountsResult.data)
      if (currenciesResult.success) setCurrencies(currenciesResult.data)
      if (officesResult.success) setOffices(officesResult.data.offices || [])
    } catch (error) {
      toast.error('Ошибка загрузки данных')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const onSubmit = async (data: AccountCreateInput) => {
    try {
      const url = editingAccount ? `/api/accounts/${editingAccount.id}` : '/api/accounts'
      const method = editingAccount ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsCreateDialogOpen(false)
        setEditingAccount(null)
        form.reset()
        fetchData()
      } else {
        toast.error(result.error || 'Ошибка сохранения счета')
      }
    } catch (error) {
      toast.error('Ошибка сохранения счета')
    }
  }

  const onAdjustSubmit = async (data: { amount: number; description: string }) => {
    if (!adjustingAccount) return

    try {
      const response = await fetch(`/api/accounts/${adjustingAccount.id}/adjust-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsAdjustDialogOpen(false)
        setAdjustingAccount(null)
        adjustForm.reset()
        fetchData()
      } else {
        toast.error(result.error || 'Ошибка корректировки баланса')
      }
    } catch (error) {
      toast.error('Ошибка корректировки баланса')
    }
  }

  const handleEdit = (account: AccountData) => {
    setEditingAccount(account)
    form.reset({
      officeId: account.officeId,
      currencyId: account.currencyId,
      type: account.type,
      name: account.name,
      description: account.description || '',
      initialBalance: account.initialBalance,
      minBalance: account.minBalance || undefined,
      maxBalance: account.maxBalance || undefined
    })
    setIsCreateDialogOpen(true)
  }

  const handleAdjustBalance = (account: AccountData) => {
    setAdjustingAccount(account)
    adjustForm.reset({
      amount: 0,
      description: ''
    })
    setIsAdjustDialogOpen(true)
  }

  const handleDelete = async (account: AccountData) => {
    if (!confirm(`Вы уверены, что хотите удалить счет ${account.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/accounts/${account.id}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        fetchData()
      } else {
        toast.error(result.error || 'Ошибка удаления счета')
      }
    } catch (error) {
      toast.error('Ошибка удаления счета')
    }
  }

  const filteredAccounts = Array.isArray(accounts) ? accounts.filter(account => {
    const matchesSearch = account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.currency?.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.office?.name.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesOffice = selectedOffice === 'all' || account.officeId === selectedOffice
    const matchesType = selectedType === 'all' || account.type === selectedType
    
    return matchesSearch && matchesOffice && matchesType
  }) : []

  const getAccountTypeLabel = (type: AccountType) => {
    switch (type) {
      case AccountType.CASH:
        return 'Наличка'
      case AccountType.CRYPTO:
        return 'Криптовалютный'
      case AccountType.BANK:
        return 'Банковский'
      case AccountType.CARD:
        return 'Карточный'
      default:
        return type
    }
  }

  const formatBalance = (balance: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(balance)
  }

  const getBalanceStatus = (account: AccountData) => {
    const balance = Number(account.balance)
    const minBalance = Number(account.minBalance || 0)
    const maxBalance = Number(account.maxBalance || Infinity)

    if (balance < minBalance) {
      return { status: 'low', color: 'text-red-600' }
    } else if (balance > maxBalance) {
      return { status: 'high', color: 'text-orange-600' }
    }
    return { status: 'normal', color: 'text-green-600' }
  }

  return (
    <div className="space-y-6 p-4 pt-6 md:p-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h1 className="text-2xl md:text-3xl font-bold">Счета офисов</h1>
        <Dialog 
          open={isCreateDialogOpen} 
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open)
            if (!open) {
              setEditingAccount(null)
              form.reset()
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Добавить счет
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Редактировать счет' : 'Добавить счет'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
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
                          {Array.isArray(offices) && offices.map((office) => (
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
                          {Array.isArray(currencies) && currencies.map((currency) => (
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
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тип счета</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите тип" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={AccountType.CASH}>Наличка</SelectItem>
                            <SelectItem value={AccountType.CRYPTO}>Криптовалютный</SelectItem>
                            <SelectItem value={AccountType.BANK}>Банковский</SelectItem>
                            <SelectItem value={AccountType.CARD}>Карточный</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="initialBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Начальный баланс</FormLabel>
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

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название счета</FormLabel>
                      <FormControl>
                        <Input placeholder="Основная касса USDT, Крипто-кошелек BTC..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание (опционально)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Дополнительная информация о счете..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="minBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Минимальный баланс (опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.00000001"
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
                    name="maxBalance"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Максимальный баланс (опционально)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.00000001"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                    {editingAccount ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Диалог корректировки баланса */}
      <Dialog 
        open={isAdjustDialogOpen} 
        onOpenChange={(open) => {
          setIsAdjustDialogOpen(open)
          if (!open) {
            setAdjustingAccount(null)
            adjustForm.reset()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Корректировка баланса: {adjustingAccount?.name}
            </DialogTitle>
          </DialogHeader>
          <Form {...adjustForm}>
            <form onSubmit={adjustForm.handleSubmit(onAdjustSubmit)} className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Текущий баланс: {adjustingAccount && formatBalance(Number(adjustingAccount.balance), adjustingAccount.currency?.decimals)} {adjustingAccount?.currency?.code}
              </div>
              
              <FormField
                control={adjustForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сумма корректировки</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.00000001"
                        placeholder="Положительное число для пополнения, отрицательное для списания"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={adjustForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Описание</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Причина корректировки..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end space-x-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAdjustDialogOpen(false)}
                >
                  Отмена
                </Button>
                <Button type="submit">
                  Выполнить корректировку
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader>
          <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск счетов..."
                className="pl-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              <Select value={selectedOffice} onValueChange={setSelectedOffice}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Офис" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все офисы</SelectItem>
                  {Array.isArray(offices) && offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="Тип счета" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value={AccountType.CASH}>Наличка</SelectItem>
                  <SelectItem value={AccountType.CRYPTO}>Криптовалютный</SelectItem>
                  <SelectItem value={AccountType.BANK}>Банковский</SelectItem>
                  <SelectItem value={AccountType.CARD}>Карточный</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <>
              {/* Таблица для средних и больших экранов */}
              <div className="hidden md:block">
                <div className="overflow-x-auto">
                  <Table className="min-w-[800px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[25%] max-w-[200px]">Название</TableHead>
                        <TableHead className="w-[15%] max-w-[120px]">Офис</TableHead>
                        <TableHead className="w-[8%] max-w-[80px]">Валюта</TableHead>
                        <TableHead className="w-[12%] max-w-[100px]">Тип</TableHead>
                        <TableHead className="w-[15%] max-w-[120px] text-right">Баланс</TableHead>
                        <TableHead className="w-[10%] max-w-[90px]">Статус</TableHead>
                        <TableHead className="w-[15%] max-w-[150px] text-right">Действия</TableHead>
                      </TableRow>
                    </TableHeader>
              <TableBody>
                {filteredAccounts.map((account) => {
                  const balanceStatus = getBalanceStatus(account)
                  return (
                    <TableRow key={account.id}>
                      <TableCell className="max-w-0">
                        <div className="truncate">
                          <div className="font-medium truncate">{account.name}</div>
                          {account.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {account.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="truncate">{account.office?.name}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {account.currency?.code}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs px-1 py-0">
                          {getAccountTypeLabel(account.type)}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${balanceStatus.color}`}>
                        <div className="flex items-center justify-end space-x-1">
                          {balanceStatus.status === 'low' && <TrendingDown className="h-3 w-3" />}
                          {balanceStatus.status === 'high' && <TrendingUp className="h-3 w-3" />}
                          <span className="truncate">
                            {formatBalance(Number(account.balance), account.currency?.decimals)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.isActive ? 'default' : 'secondary'} className="text-xs px-2 py-0">
                          {account.isActive ? 'Вкл' : 'Выкл'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAdjustBalance(account)}
                            className="text-xs px-1 h-7 hidden xl:inline-flex"
                            title="Корректировка баланса"
                          >
                            Корр.
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(account)}
                            className="px-1 h-7"
                            title="Редактировать"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(account)}
                            className="px-1 h-7"
                            title="Удалить"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredAccounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Счета не найдены
                    </TableCell>
                  </TableRow>
                )}
                </TableBody>
                </Table>
              </div>
            </div>

              {/* Карточки для мобильных устройств */}
              <div className="md:hidden space-y-4 p-4">
                {filteredAccounts.map((account) => {
                  const balanceStatus = getBalanceStatus(account)
                  return (
                    <Card key={account.id} className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm truncate">{account.name}</h3>
                          {account.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {account.description}
                            </p>
                          )}
                        </div>
                        <Badge variant={account.isActive ? 'default' : 'secondary'} className="ml-2 flex-shrink-0">
                          {account.isActive ? 'Активен' : 'Неактивен'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Офис:</span>
                          <span className="font-medium">{account.office?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Валюта:</span>
                          <span className="font-mono">{account.currency?.code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Тип:</span>
                          <Badge variant="outline" className="text-xs">
                            {getAccountTypeLabel(account.type)}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Баланс:</span>
                          <div className={`flex items-center space-x-1 font-mono ${balanceStatus.color}`}>
                            {balanceStatus.status === 'low' && <TrendingDown className="h-3 w-3" />}
                            {balanceStatus.status === 'high' && <TrendingUp className="h-3 w-3" />}
                            <span className="text-sm">
                              {formatBalance(Number(account.balance), account.currency?.decimals)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 mt-4 pt-3 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAdjustBalance(account)}
                          className="text-xs"
                        >
                          Корректировка
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(account)}
                          className="text-xs"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(account)}
                          className="text-xs"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  )
                })}
                {filteredAccounts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    Счета не найдены
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
