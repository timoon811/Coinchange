"use client"

import { Wallet, CreditCard, Banknote } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface DirectionSelectSimpleProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function DirectionSelectSimple({
  value,
  onValueChange,
  placeholder = "Выберите направление операции...",
  disabled = false,
  className
}: DirectionSelectSimpleProps) {
  return (
    <div className={className}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="justify-start">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          <SelectItem value="CRYPTO_TO_CASH">
            <div className="flex items-start gap-2">
              <Wallet className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="font-medium text-left">Крипта → Наличные</div>
                <div className="text-xs text-muted-foreground text-left">Обмен криптовалюты на наличные деньги</div>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="CASH_TO_CRYPTO">
            <div className="flex items-start gap-2">
              <Banknote className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="font-medium text-left">Наличные → Крипта</div>
                <div className="text-xs text-muted-foreground text-left">Покупка криптовалюты за наличные</div>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="CRYPTO_TO_CARD">
            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="font-medium text-left">Крипта → Карта</div>
                <div className="text-xs text-muted-foreground text-left">Перевод криптовалюты на банковскую карту</div>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="CARD_TO_CRYPTO">
            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="font-medium text-left">Карта → Крипта</div>
                <div className="text-xs text-muted-foreground text-left">Покупка криптовалюты с банковской карты</div>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="CARD_TO_CASH">
            <div className="flex items-start gap-2">
              <CreditCard className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="font-medium text-left">Карта → Наличные</div>
                <div className="text-xs text-muted-foreground text-left">Снятие наличных с банковской карты</div>
              </div>
            </div>
          </SelectItem>
          <SelectItem value="CASH_TO_CARD">
            <div className="flex items-start gap-2">
              <Banknote className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="font-medium text-left">Наличные → Карта</div>
                <div className="text-xs text-muted-foreground text-left">Пополнение банковской карты наличными</div>
              </div>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
