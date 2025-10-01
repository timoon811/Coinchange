"use client"

import { Building } from 'lucide-react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface Office {
  id: string
  name: string
  city: string
  address?: string
  phone?: string
}

interface OfficeSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  offices: Office[]
}

export function OfficeSelect({
  value,
  onValueChange,
  placeholder = "Выберите офис...",
  disabled = false,
  className,
  offices
}: OfficeSelectProps) {
  return (
    <div className={className}>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger className="justify-start">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] overflow-y-auto">
          {offices.map((office) => (
            <SelectItem key={office.id} value={office.id}>
              <div className="flex items-start gap-2">
                <Building className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col gap-1 min-w-0 flex-1">
                  <div className="font-medium text-left">{office.name}</div>
                  <div className="text-xs text-muted-foreground text-left">
                    {office.city}
                    {office.address && ` • ${office.address}`}
                  </div>
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
