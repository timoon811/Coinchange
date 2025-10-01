"use client"

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Send,
  AlertCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ClientSearchSelect } from '@/components/ui/client-search-select'
import { OfficeSelect } from '@/components/ui/office-select'
import { DirectionSelectSimple } from '@/components/ui/direction-select-simple'

interface Office {
  id: string
  name: string
  city: string
}

export default function NewRequestPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [offices, setOffices] = useState<Office[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  
  // Форма данных
  const [formData, setFormData] = useState({
    clientId: '',
    officeId: '',
    direction: '',
    fromCurrency: '',
    toCurrency: '',
    expectedAmountFrom: '',
    walletAddress: '',
    cardNumber: '',
    bankName: '',
    comment: '',
  })

  const { execute: fetchOffices } = useApi<{data: {offices: Office[], pagination: any}}>()
  const { execute: fetchCurrencies } = useApi<{data: Array<{code: string, isActive: boolean}>}>()
  const { execute: createRequest, loading: creating } = useApi()

  // Загрузка данных
  useEffect(() => {
    const loadData = async () => {
      const [officesResult, currenciesResult] = await Promise.all([
        fetchOffices('/api/admin/offices?limit=100'),
        fetchCurrencies('/api/currencies?isActive=true'),
      ])

      if (officesResult?.data?.offices && Array.isArray(officesResult.data.offices)) {
        setOffices(officesResult.data.offices)
      }
      if (currenciesResult?.data && Array.isArray(currenciesResult.data)) {
        setCurrencies(currenciesResult.data.map(c => c.code))
      }
    }

    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Валидация
    if (!formData.clientId || !formData.direction || !formData.fromCurrency || !formData.expectedAmountFrom) {
      toast.error('Заполните все обязательные поля')
      return
    }

    const requestData = {
      clientId: formData.clientId,
      officeId: formData.officeId || undefined,
      direction: formData.direction,
      finance: {
        fromCurrency: formData.fromCurrency,
        toCurrency: formData.toCurrency || formData.fromCurrency, // fallback if toCurrency not selected
        expectedAmountFrom: parseFloat(formData.expectedAmountFrom),
        expectedAmountTo: formData.toCurrency ? parseFloat(formData.expectedAmountFrom) * 0.98 : undefined, // Примерный курс
        rateValue: 0.98,
        commissionPercent: 2.0,
      },
      requisites: formData.walletAddress || formData.cardNumber || formData.bankName ? {
        walletAddress: formData.walletAddress || undefined,
        cardNumber: formData.cardNumber || undefined,
        bankName: formData.bankName || undefined,
      } : undefined,
      comment: formData.comment || undefined,
    }

    const result = await createRequest('/api/requests', {
      method: 'POST',
      body: JSON.stringify(requestData),
    })

    if (result) {
      toast.success('Заявка успешно создана')
      router.push('/dashboard/requests')
    } else {
      toast.error('Ошибка создания заявки')
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }


  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="h-9 w-9 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Создание новой заявки</h1>
          <p className="text-muted-foreground">Заполните форму для создания заявки</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Основная информация */}
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>Базовые данные заявки</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Клиент *</Label>
                <ClientSearchSelect
                  value={formData.clientId}
                  onValueChange={(value) => updateField('clientId', value)}
                  placeholder="Найдите и выберите клиента"
                />
              </div>

              {user?.role === 'ADMIN' && (
                <div className="space-y-2">
                  <Label htmlFor="officeId">Офис</Label>
                  <OfficeSelect
                    value={formData.officeId}
                    onValueChange={(value) => updateField('officeId', value)}
                    placeholder="Выберите офис"
                    offices={offices}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="direction">Направление операции *</Label>
                <DirectionSelectSimple
                  value={formData.direction}
                  onValueChange={(value) => updateField('direction', value)}
                  placeholder="Выберите направление"
                />
              </div>
            </CardContent>
          </Card>

          {/* Финансовая информация */}
          <Card>
            <CardHeader>
              <CardTitle>Финансовая информация</CardTitle>
              <CardDescription>Валюты и суммы</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fromCurrency">Валюта отдаем *</Label>
                <Select value={formData.fromCurrency} onValueChange={(value) => updateField('fromCurrency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="toCurrency">Валюта получаем</Label>
                <Select value={formData.toCurrency} onValueChange={(value) => updateField('toCurrency', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите валюту" />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expectedAmountFrom">Сумма *</Label>
                <Input
                  id="expectedAmountFrom"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.expectedAmountFrom}
                  onChange={(e) => updateField('expectedAmountFrom', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Реквизиты */}
          <Card>
            <CardHeader>
              <CardTitle>Реквизиты</CardTitle>
              <CardDescription>Платежные данные</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(formData.direction === 'CRYPTO_TO_CASH' || formData.direction === 'CRYPTO_TO_CARD') && (
                <div className="space-y-2">
                  <Label htmlFor="walletAddress">Адрес кошелька</Label>
                  <Input
                    id="walletAddress"
                    placeholder="Адрес криптокошелька"
                    value={formData.walletAddress}
                    onChange={(e) => updateField('walletAddress', e.target.value)}
                  />
                </div>
              )}

              {(formData.direction === 'CARD_TO_CRYPTO' || formData.direction === 'CARD_TO_CASH') && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="cardNumber">Номер карты</Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={formData.cardNumber}
                      onChange={(e) => updateField('cardNumber', e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bankName">Банк</Label>
                    <Input
                      id="bankName"
                      placeholder="Название банка"
                      value={formData.bankName}
                      onChange={(e) => updateField('bankName', e.target.value)}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Комментарий */}
          <Card>
            <CardHeader>
              <CardTitle>Дополнительная информация</CardTitle>
              <CardDescription>Комментарии и примечания</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="comment">Комментарий</Label>
                <Textarea
                  id="comment"
                  placeholder="Дополнительная информация о заявке"
                  value={formData.comment}
                  onChange={(e) => updateField('comment', e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Кнопки действий */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Отмена
          </Button>
          <Button type="submit" disabled={creating}>
            {creating ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                Создание...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Создать заявку
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
