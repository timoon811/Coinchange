'use client'

import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { currencyCreateSchema, type CurrencyCreateInput, type CurrencyData } from '@/lib/types'
import { CurrencyType } from '@prisma/client'

export default function CurrenciesPage() {
  const [currencies, setCurrencies] = useState<CurrencyData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingCurrency, setEditingCurrency] = useState<CurrencyData | null>(null)

  const form = useForm<CurrencyCreateInput>({
    resolver: zodResolver(currencyCreateSchema),
    defaultValues: {
      code: '',
      name: '',
      symbol: '',
      type: CurrencyType.CRYPTO,
      decimals: 8,
      isActive: true
    }
  })

  const fetchCurrencies = async () => {
    try {
      const params = new URLSearchParams()
      if (selectedType !== 'all') {
        params.append('type', selectedType)
      }
      
      const response = await fetch(`/api/currencies?${params}`, {
        credentials: 'include'
      })
      const result = await response.json()
      
      if (result.success) {
        setCurrencies(result.data)
      } else {
        toast.error('Ошибка загрузки валют')
      }
    } catch (error) {
      console.error('Fetch currencies error:', error)
      toast.error('Ошибка загрузки валют')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCurrencies()
  }, [selectedType])

  const onSubmit = async (data: CurrencyCreateInput) => {
    try {
      const url = editingCurrency ? `/api/currencies/${editingCurrency.id}` : '/api/currencies'
      const method = editingCurrency ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        setIsCreateDialogOpen(false)
        setEditingCurrency(null)
        form.reset()
        fetchCurrencies()
      } else {
        toast.error(result.error || 'Ошибка сохранения валюты')
      }
    } catch (error) {
      console.error('Save currency error:', error)
      toast.error('Ошибка сохранения валюты')
    }
  }

  const handleEdit = (currency: CurrencyData) => {
    setEditingCurrency(currency)
    form.reset({
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol || '',
      type: currency.type,
      decimals: currency.decimals,
      isActive: currency.isActive
    })
    setIsCreateDialogOpen(true)
  }

  const handleDelete = async (currency: CurrencyData) => {
    if (!confirm(`Вы уверены, что хотите удалить валюту ${currency.name}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/currencies/${currency.id}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      const result = await response.json()
      
      if (result.success) {
        toast.success(result.message)
        fetchCurrencies()
      } else {
        toast.error(result.error || 'Ошибка удаления валюты')
      }
    } catch (error) {
      console.error('Delete currency error:', error)
      toast.error('Ошибка удаления валюты')
    }
  }

  const filteredCurrencies = currencies.filter(currency =>
    currency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    currency.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getCurrencyTypeLabel = (type: CurrencyType) => {
    switch (type) {
      case CurrencyType.CRYPTO:
        return 'Криптовалюта'
      case CurrencyType.FIAT:
        return 'Фиатная валюта'
      case CurrencyType.CASH:
        return 'Наличные'
      default:
        return type
    }
  }

  const getCurrencyTypeBadgeColor = (type: CurrencyType) => {
    switch (type) {
      case CurrencyType.CRYPTO:
        return 'bg-blue-100 text-blue-800'
      case CurrencyType.FIAT:
        return 'bg-green-100 text-green-800'
      case CurrencyType.CASH:
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Заголовок - фиксированная высота */}
      <div className="flex-shrink-0 border-b bg-background px-4 py-4 md:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Валюты</h1>
            <p className="text-sm text-muted-foreground">
              Управление валютами системы
            </p>
          </div>
          <Dialog 
            open={isCreateDialogOpen} 
            onOpenChange={(open) => {
              setIsCreateDialogOpen(open)
              if (!open) {
                setEditingCurrency(null)
                form.reset()
              }
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Добавить валюту
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-md mx-auto">
            <DialogHeader className="pb-4">
              <DialogTitle>
                {editingCurrency ? 'Редактировать валюту' : 'Добавить валюту'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код валюты</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="USDT, BTC, USD..." 
                          {...field}
                          disabled={!!editingCurrency}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название</FormLabel>
                      <FormControl>
                        <Input placeholder="Tether USD, Bitcoin..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Символ (опционально)</FormLabel>
                      <FormControl>
                        <Input placeholder="₿, $, ₽..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тип валюты</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите тип" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={CurrencyType.CRYPTO}>Криптовалюта</SelectItem>
                          <SelectItem value={CurrencyType.FIAT}>Фиатная валюта</SelectItem>
                          <SelectItem value={CurrencyType.CASH}>Наличные</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="decimals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Количество знаков после запятой</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="0" 
                          max="18" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Активна
                        </FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Валюта будет доступна для использования в системе
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Отмена
                  </Button>
                  <Button type="submit">
                    {editingCurrency ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Фильтры - компактные */}
      <div className="flex-shrink-0 border-b bg-muted/20 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск валют..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Тип валюты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value={CurrencyType.CRYPTO}>Криптовалюта</SelectItem>
              <SelectItem value={CurrencyType.FIAT}>Фиатная валюта</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Основной контент */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto">
          <div className="px-4 py-4 md:px-6">
            <Card>
              <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8">Загрузка...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[800px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Код</TableHead>
                  <TableHead className="px-4 py-3">Название</TableHead>
                  <TableHead className="px-4 py-3">Символ</TableHead>
                  <TableHead className="px-4 py-3">Тип</TableHead>
                  <TableHead className="px-4 py-3">Знаков после запятой</TableHead>
                  <TableHead className="px-4 py-3">Статус</TableHead>
                  <TableHead className="text-right px-4 py-3">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCurrencies.map((currency) => (
                  <TableRow key={currency.id}>
                    <TableCell className="font-mono font-semibold px-4 py-3">
                      {currency.code}
                    </TableCell>
                    <TableCell className="px-4 py-3">{currency.name}</TableCell>
                    <TableCell className="px-4 py-3">{currency.symbol || '—'}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge className={getCurrencyTypeBadgeColor(currency.type)}>
                        {getCurrencyTypeLabel(currency.type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-3">{currency.decimals}</TableCell>
                    <TableCell className="px-4 py-3">
                      <Badge variant={currency.isActive ? 'default' : 'secondary'}>
                        {currency.isActive ? 'Активна' : 'Неактивна'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right px-4 py-3">
                      <div className="flex justify-end space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(currency)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(currency)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredCurrencies.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 px-4">
                      Валюты не найдены
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </div>
          )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
