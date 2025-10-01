"use client"

import { useState } from 'react'
import { Check, ChevronsUpDown, Wallet, CreditCard, Banknote, ArrowRightLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface DirectionOption {
  value: string
  label: string
  icon: React.ReactNode
  description: string
}

interface DirectionSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const directionOptions: DirectionOption[] = [
  {
    value: 'CRYPTO_TO_CASH',
    label: 'Крипта → Наличные',
    icon: <Wallet className="h-4 w-4" />,
    description: 'Обмен криптовалюты на наличные деньги'
  },
  {
    value: 'CASH_TO_CRYPTO',
    label: 'Наличные → Крипта',
    icon: <Banknote className="h-4 w-4" />,
    description: 'Покупка криптовалюты за наличные'
  },
  {
    value: 'CRYPTO_TO_CARD',
    label: 'Крипта → Карта',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Перевод криптовалюты на банковскую карту'
  },
  {
    value: 'CARD_TO_CRYPTO',
    label: 'Карта → Крипта',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Покупка криптовалюты с банковской карты'
  },
  {
    value: 'CARD_TO_CASH',
    label: 'Карта → Наличные',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Снятие наличных с банковской карты'
  },
  {
    value: 'CASH_TO_CARD',
    label: 'Наличные → Карта',
    icon: <Banknote className="h-4 w-4" />,
    description: 'Пополнение банковской карты наличными'
  },
  // Дополнительные направления для тестирования скролла
  {
    value: 'CRYPTO_TO_CRYPTO',
    label: 'Крипта → Крипта',
    icon: <Wallet className="h-4 w-4" />,
    description: 'Обмен одной криптовалюты на другую'
  },
  {
    value: 'CASH_TO_CASH',
    label: 'Наличные → Наличные',
    icon: <Banknote className="h-4 w-4" />,
    description: 'Обмен наличных разных валют'
  },
  {
    value: 'CARD_TO_CARD',
    label: 'Карта → Карта',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Перевод с карты на карту'
  },
  {
    value: 'CRYPTO_TO_BANK',
    label: 'Крипта → Банк',
    icon: <Wallet className="h-4 w-4" />,
    description: 'Перевод криптовалюты на банковский счет'
  },
  {
    value: 'BANK_TO_CRYPTO',
    label: 'Банк → Крипта',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Покупка криптовалюты с банковского счета'
  },
  {
    value: 'CRYPTO_TO_PAYMENT',
    label: 'Крипта → Платеж',
    icon: <Wallet className="h-4 w-4" />,
    description: 'Оплата товаров/услуг криптовалютой'
  }
]

export function DirectionSelect({
  value,
  onValueChange,
  placeholder = "Выберите направление операции...",
  disabled = false,
  className
}: DirectionSelectProps) {
  const [open, setOpen] = useState(false)

  const selectedDirection = directionOptions.find(direction => direction.value === value)

  const handleSelect = (directionValue: string) => {
    onValueChange(directionValue)
    setOpen(false)
  }

  return (
    <div className={cn("w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-10"
            disabled={disabled}
          >
            {selectedDirection ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {selectedDirection.icon}
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {selectedDirection.label}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedDirection.description}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <ArrowRightLeft className="h-4 w-4" />
                {placeholder}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 max-h-[300px]" align="start">
          <Command>
            <CommandList className="max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              <CommandEmpty>
                <div className="p-4 text-center">
                  <div className="text-sm text-muted-foreground">Направления не найдены</div>
                </div>
              </CommandEmpty>
              <CommandGroup>
                {directionOptions.map((direction) => (
                  <CommandItem
                    key={direction.value}
                    value={direction.value}
                    onSelect={() => handleSelect(direction.value)}
                    className="flex items-center gap-3 p-3"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        value === direction.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {direction.icon}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">
                          {direction.label}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {direction.description}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Показываем информацию о выбранном направлении */}
      {selectedDirection && (
        <div className="mt-2 text-xs text-muted-foreground">
          Выбрано: {selectedDirection.label}
        </div>
      )}
    </div>
  )
}
