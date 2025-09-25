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

interface Client {
  id: string
  username: string
  firstName: string
  lastName: string
  phone: string | null
}

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
  const [clients, setClients] = useState<Client[]>([])
  const [offices, setOffices] = useState<Office[]>([])
  const [currencies, setCurrencies] = useState<string[]>([])
  const [step, setStep] = useState(1)
  
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

  const { execute: fetchClients } = useApi<{data: Client[]}>()
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
    const [clientsResult, officesResult, currenciesResult] = await Promise.all([
      fetchClients('/api/clients?limit=100'),
      fetchOffices('/api/admin/offices?limit=100'),
      fetchCurrencies('/api/currencies?isActive=true'),
    ])

    if (clientsResult?.data && Array.isArray(clientsResult.data)) {
      setClients(clientsResult.data)
    }
    if (officesResult?.data?.offices && Array.isArray(officesResult.data.offices)) {
      setOffices(officesResult.data.offices)
    }
    if (currenciesResult?.data && Array.isArray(currenciesResult.data)) {
      setCurrencies(currenciesResult.data.map(c => c.code))
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

  
  const directionLabels = {
    'CRYPTO_TO_CASH': 'Крипта → Наличные',
    'CASH_TO_CRYPTO': 'Наличные → Крипта',
    'CRYPTO_TO_CARD': 'Крипта → Карта',
    'CARD_TO_CRYPTO': 'Карта → Крипта',
    'CARD_TO_CASH': 'Карта → Наличные',
    'CASH_TO_CARD': 'Наличные → Карта',
  }

  const getDirectionIcon = (direction: string) => {
    if (direction.includes('CRYPTO')) return <Wallet className="h-4 w-4" />
    if (direction.includes('CARD')) return <CreditCard className="h-4 w-4" />
    if (direction.includes('CASH')) return <Banknote className="h-4 w-4" />
    return <ArrowRightLeft className="h-4 w-4" />
  }

  const selectedClient = clients.find(c => c.id === formData.clientId)
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
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">Создание новой заявки</DialogTitle>
              <DialogDescription>
                Заполните информацию для создания заявки на обмен
              </DialogDescription>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 border-2 ${
                step >= 1 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border text-muted-foreground'
              }`}>
                1
              </div>
              <div className={`w-12 h-0.5 transition-all duration-200 ${
                step >= 2 ? 'bg-primary' : 'bg-border'
              }`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 border-2 ${
                step >= 2 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border text-muted-foreground'
              }`}>
                2
              </div>
              <div className={`w-12 h-0.5 transition-all duration-200 ${
                step >= 3 ? 'bg-primary' : 'bg-border'
              }`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-200 border-2 ${
                step >= 3 
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-background border-border text-muted-foreground'
              }`}>
                3
              </div>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-6 animate-in slide-in-from-right-5 duration-300">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Основная информация</CardTitle>
                  <CardDescription>Выберите клиента и тип операции</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="clientId">
                      Клиент <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.clientId} onValueChange={(value) => updateField('clientId', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Найдите и выберите клиента" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[200px]">
                        {clients.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            Клиенты не найдены
                          </div>
                        ) : (
                          clients.map((client) => (
                            <SelectItem key={client.id} value={client.id} className="flex flex-col items-start">
                              <div className="flex items-center gap-2 w-full">
                                <div className="flex-1">
                                  <div className="font-medium">
                                    {client.firstName} {client.lastName}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    @{client.username} {client.phone && `• ${client.phone}`}
                                  </div>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  ID: {client.id.slice(-6)}
                                </Badge>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {formData.clientId && (
                      <div className="text-xs text-muted-foreground">
                        Выбран: {clients.find(c => c.id === formData.clientId)?.firstName} {clients.find(c => c.id === formData.clientId)?.lastName}
                      </div>
                    )}
                  </div>

                  {user?.role === UserRole.ADMIN && (
                    <div className="space-y-2">
                      <Label htmlFor="officeId">Офис</Label>
                      <Select value={formData.officeId} onValueChange={(value) => updateField('officeId', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите офис" />
                        </SelectTrigger>
                        <SelectContent>
                          {offices.map((office) => (
                            <SelectItem key={office.id} value={office.id}>
                              {office.name} ({office.city})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="direction">
                      Направление операции <span className="text-red-500">*</span>
                    </Label>
                    <Select value={formData.direction} onValueChange={(value) => updateField('direction', value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите направление обмена" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(directionLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            <div className="flex items-center gap-2">
                              {getDirectionIcon(value)}
                              {label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button 
                  type="button" 
                  onClick={() => setStep(2)}
                  disabled={!formData.clientId || !formData.direction}
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
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fromCurrency">
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
                    <Label htmlFor="expectedAmountFrom">
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

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Назад
                </Button>
                <Button 
                  type="button" 
                  onClick={() => setStep(3)}
                  disabled={!formData.fromCurrency || !formData.expectedAmountFrom}
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
                  <CardContent className="space-y-4">
                
                {/* Адрес кошелька для получения криптовалюты */}
                {(formData.direction === 'CASH_TO_CRYPTO' || formData.direction === 'CARD_TO_CRYPTO') && (
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="walletAddress">
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
                      <Label htmlFor="cardNumber">
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
                      <Label htmlFor="bankName">
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
                    <Label htmlFor="comment">Комментарий</Label>
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Клиент:</span>
                      <div className="font-medium">
                        {selectedClient?.firstName} {selectedClient?.lastName} (@{selectedClient?.username})
                      </div>
                    </div>
                    {selectedOffice && (
                      <div>
                        <span className="text-muted-foreground">Офис:</span>
                        <div className="font-medium">{selectedOffice.name} ({selectedOffice.city})</div>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Направление:</span>
                      <div className="font-medium flex items-center gap-2">
                        {getDirectionIcon(formData.direction)}
                        {directionLabels[formData.direction as keyof typeof directionLabels]}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Обмен:</span>
                      <div className="font-medium">
                        {formData.expectedAmountFrom} {formData.fromCurrency}
                        {formData.toCurrency && ` → ${formData.toCurrency}`}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-between">
                <Button type="button" variant="outline" onClick={() => setStep(2)}>
                  Назад
                </Button>
                <Button 
                  type="submit" 
                  disabled={creating}
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
