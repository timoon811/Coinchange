"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import { toast } from 'sonner'
import {
  Plus,
  AlertCircle,
  CreditCard,
  Wallet,
  Banknote,
  ArrowRightLeft,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UserRole } from '@prisma/client'
import { ClientSearchSelect } from '@/components/ui/client-search-select'
import { OfficeSelect } from '@/components/ui/office-select'
import { DirectionSelectSimple } from '@/components/ui/direction-select-simple'

interface Office {
  id: string
  name: string
  city: string
}

interface CreateRequestModalProps {
  onRequestCreated?: () => void
}

export function CreateRequestModal({ onRequestCreated }: CreateRequestModalProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [offices, setOffices] = useState<Office[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [step, setStep] = useState(1)
  const [loadingError, setLoadingError] = useState<string | null>(null)
  
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

  // Загрузка данных при открытии модального окна
  useEffect(() => {
    if (open) {
      loadData()
    }
  }, [open])

  const loadData = async () => {
    setLoadingError(null)
    try {
      const [officesResult, currenciesResult] = await Promise.all([
        fetchOffices('/api/admin/offices?limit=100'),
        fetchCurrencies('/api/currencies?isActive=true'),
      ])

      console.log('CreateRequestModal: officesResult:', officesResult) // Debug log
      console.log('CreateRequestModal: currenciesResult:', currenciesResult) // Debug log

      if (officesResult?.data?.offices && Array.isArray(officesResult.data.offices)) {
        setOffices(officesResult.data.offices)
      } else {
        setLoadingError('Не удалось загрузить список офисов')
      }
      
      if (currenciesResult && Array.isArray(currenciesResult)) {
        setCurrencies(currenciesResult.map(c => c.code))
      } else {
        setLoadingError('Не удалось загрузить список валют')
      }
    } catch (error) {
      console.error('Failed to load data:', error)
      setLoadingError('Ошибка загрузки данных. Проверьте авторизацию.')
    }
  }

  const resetForm = () => {
    setFormData({
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
    setStep(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Валидация
    if (!formData.clientId || !formData.direction || !formData.fromCurrency || !formData.expectedAmountFrom) {
      toast.error('Заполните все обязательные поля')
      return
    }

    // Проверка реквизитов в зависимости от направления
    if ((formData.direction === 'CASH_TO_CRYPTO' || formData.direction === 'CARD_TO_CRYPTO') && !formData.walletAddress) {
      toast.error('Укажите адрес кошелька для получения криптовалюты')
      return
    }

    if ((formData.direction === 'CRYPTO_TO_CARD' || formData.direction === 'CASH_TO_CARD') && (!formData.cardNumber || !formData.bankName)) {
      toast.error('Укажите номер карты и банк для получения средств')
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
        expectedAmountTo: formData.toCurrency ? parseFloat(formData.expectedAmountFrom) * 0.98 : undefined,
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
      setOpen(false)
      resetForm()
      onRequestCreated?.()
    } else {
      toast.error('Ошибка создания заявки')
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const getDirectionLabel = (direction: string) => {
    const labels: Record<string, string> = {
      'CRYPTO_TO_CASH': 'Крипта → Наличные',
      'CASH_TO_CRYPTO': 'Наличные → Крипта',
      'CRYPTO_TO_CARD': 'Крипта → Карта',
      'CARD_TO_CRYPTO': 'Карта → Крипта',
      'CARD_TO_CASH': 'Карта → Наличные',
      'CASH_TO_CARD': 'Наличные → Карта',
      'CRYPTO_TO_CRYPTO': 'Крипта → Крипта',
      'CASH_TO_CASH': 'Наличные → Наличные',
      'CARD_TO_CARD': 'Карта → Карта',
      'CRYPTO_TO_BANK': 'Крипта → Банк',
      'BANK_TO_CRYPTO': 'Банк → Крипта',
      'CRYPTO_TO_PAYMENT': 'Крипта → Платеж',
    }
    return labels[direction] || direction
  }

  const selectedOffice = offices.find(o => o.id === formData.officeId)

  return (
    <Dialog open={open} onOpenChange={(open) => {
      setOpen(open)
      if (!open) {
        resetForm()
      }
    }}>
      <DialogTrigger asChild>
        <Button className="ml-4">
          <Plus className="mr-2 h-4 w-4" />
          Создать заявку
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto w-[95vw] sm:w-full">
        <DialogHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-lg sm:text-xl font-semibold">Создание новой заявки</DialogTitle>
              <DialogDescription className="text-sm">
                Заполните информацию для создания заявки на обмен
              </DialogDescription>
            </div>
            <div className="flex items-center justify-center gap-2 sm:gap-3 text-sm">
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 border-2 ${
                step >= 1 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border text-muted-foreground'
              }`}>
                1
              </div>
              <div className={`w-8 sm:w-12 h-0.5 transition-all duration-200 ${
                step >= 2 ? 'bg-primary' : 'bg-border'
              }`} />
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 border-2 ${
                step >= 2 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border text-muted-foreground'
              }`}>
                2
              </div>
              <div className={`w-8 sm:w-12 h-0.5 transition-all duration-200 ${
                step >= 3 ? 'bg-primary' : 'bg-border'
              }`} />
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 border-2 ${
                step >= 3 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border text-muted-foreground'
              }`}>
                3
              </div>
            </div>
          </div>
        </DialogHeader>

        {loadingError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div className="text-sm text-red-700">{loadingError}</div>
            </div>
            <div className="text-xs text-red-600 mt-1">
              Убедитесь, что вы авторизованы в системе
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Основная информация</CardTitle>
                  <CardDescription>Выберите клиента и тип операции</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="clientId" className="text-sm font-medium">
                      Клиент <span className="text-red-500">*</span>
                    </Label>
                    <ClientSearchSelect
                      value={formData.clientId}
                      onValueChange={(value) => updateField('clientId', value)}
                      placeholder="Найдите и выберите клиента"
                    />
                  </div>

                  {user?.role === UserRole.ADMIN && (
                    <div className="space-y-2">
                      <Label htmlFor="officeId" className="text-sm font-medium">Офис</Label>
                      <OfficeSelect
                        value={formData.officeId}
                        onValueChange={(value) => updateField('officeId', value)}
                        placeholder="Выберите офис"
                        offices={offices}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="direction" className="text-sm font-medium">
                      Направление операции <span className="text-red-500">*</span>
                    </Label>
                    <DirectionSelectSimple
                      value={formData.direction}
                      onValueChange={(value) => updateField('direction', value)}
                      placeholder="Выберите направление обмена"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end pt-4">
                <Button 
                  type="button" 
                  onClick={() => setStep(2)}
                  disabled={!formData.clientId || !formData.direction}
                  className="w-full sm:w-auto"
                >
                  Далее
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Финансовая информация</CardTitle>
                  <CardDescription>Укажите валюты и сумму операции</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="fromCurrency" className="text-sm font-medium">
                      Валюта отдаем <span className="text-red-500">*</span>
                    </Label>
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
                    <Label htmlFor="toCurrency" className="text-sm font-medium">Валюта получаем</Label>
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
                    <Label htmlFor="expectedAmountFrom" className="text-sm font-medium">
                      Сумма <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="expectedAmountFrom"
                      type="number"
                      step="0.01"
                      placeholder="Введите сумму"
                      value={formData.expectedAmountFrom}
                      onChange={(e) => updateField('expectedAmountFrom', e.target.value)}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full sm:w-auto">
                  Назад
                </Button>
                <Button 
                  type="button" 
                  onClick={() => setStep(3)}
                  disabled={!formData.fromCurrency || !formData.expectedAmountFrom}
                  className="w-full sm:w-auto"
                >
                  Далее
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
              {/* Реквизиты */}
              {((formData.direction === 'CASH_TO_CRYPTO' || formData.direction === 'CARD_TO_CRYPTO') ||
                (formData.direction === 'CRYPTO_TO_CARD' || formData.direction === 'CASH_TO_CARD')) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Реквизиты получателя</CardTitle>
                    <CardDescription>
                      {(formData.direction === 'CASH_TO_CRYPTO' || formData.direction === 'CARD_TO_CRYPTO') 
                        ? 'Адрес криптокошелька для получения' 
                        : 'Данные банковской карты для получения'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                
                {/* Адрес кошелька для получения криптовалюты */}
                {(formData.direction === 'CASH_TO_CRYPTO' || formData.direction === 'CARD_TO_CRYPTO') && (
                  <div className="space-y-2">
                    <Label htmlFor="walletAddress" className="text-sm font-medium">
                      Адрес кошелька получателя <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="walletAddress"
                      placeholder="Адрес кошелька для получения криптовалюты"
                      value={formData.walletAddress}
                      onChange={(e) => updateField('walletAddress', e.target.value)}
                    />
                  </div>
                )}

                {(formData.direction === 'CRYPTO_TO_CARD' || formData.direction === 'CASH_TO_CARD') && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber" className="text-sm font-medium">
                        Номер карты <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        value={formData.cardNumber}
                        onChange={(e) => updateField('cardNumber', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bankName" className="text-sm font-medium">
                        Банк <span className="text-red-500">*</span>
                      </Label>
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
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Дополнительная информация</CardTitle>
                  <CardDescription>Комментарий к заявке (опционально)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label htmlFor="comment" className="text-sm font-medium">Комментарий</Label>
                    <Textarea
                      id="comment"
                      placeholder="Дополнительная информация о заявке"
                      value={formData.comment}
                      onChange={(e) => updateField('comment', e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Сводка заявки */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Сводка заявки</CardTitle>
                  <CardDescription>Проверьте данные перед созданием</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    {selectedOffice && (
                      <div className="space-y-1">
                        <span className="text-muted-foreground text-xs">Офис:</span>
                        <div className="font-medium">{selectedOffice.name} ({selectedOffice.city})</div>
                      </div>
                    )}
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-xs">Направление:</span>
                      <div className="font-medium">
                        {getDirectionLabel(formData.direction)}
                      </div>
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-muted-foreground text-xs">Обмен:</span>
                      <div className="font-medium">
                        {formData.expectedAmountFrom} {formData.fromCurrency}
                        {formData.toCurrency && ` → ${formData.toCurrency}`}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(2)} className="w-full sm:w-auto">
                  Назад
                </Button>
                <Button 
                  type="submit" 
                  disabled={creating}
                  className="w-full sm:w-auto"
                >
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
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
