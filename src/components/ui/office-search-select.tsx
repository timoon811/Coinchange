"use client"

import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { Check, ChevronsUpDown, Search, Building } from 'lucide-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'

interface Office {
  id: string
  name: string
  city: string
  address?: string
  phone?: string
}

interface OfficeSearchSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function OfficeSearchSelect({
  value,
  onValueChange,
  placeholder = "Найдите офис...",
  disabled = false,
  className
}: OfficeSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [offices, setOffices] = useState<Office[]>([])
  const [allOffices, setAllOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(false)

  const { execute: fetchOffices } = useApi<{data: {offices: Office[], pagination: any}}>()

  // Загружаем все офисы при первом открытии
  useEffect(() => {
    if (open && allOffices.length === 0) {
      loadAllOffices()
    }
  }, [open])

  const loadAllOffices = async () => {
    setLoading(true)
    try {
      const result = await fetchOffices('/api/admin/offices?limit=100')
      if (result?.data?.offices && Array.isArray(result.data.offices)) {
        setAllOffices(result.data.offices)
        setOffices(result.data.offices.slice(0, 20)) // Показываем первые 20
      }
    } catch (error) {
      console.error('Failed to load offices:', error)
    } finally {
      setLoading(false)
    }
  }

  // Фильтрация офисов с debounce
  const filteredOffices = useMemo(() => {
    if (!searchQuery) {
      return allOffices.slice(0, 20)
    }

    const query = searchQuery.toLowerCase()
    return allOffices.filter(office => 
      office.name?.toLowerCase().includes(query) ||
      office.city?.toLowerCase().includes(query) ||
      office.address?.toLowerCase().includes(query) ||
      office.id.toLowerCase().includes(query)
    ).slice(0, 10) // Ограничиваем результаты поиска
  }, [allOffices, searchQuery])

  const selectedOffice = allOffices.find(office => office.id === value)

  const handleSelect = (officeId: string) => {
    onValueChange(officeId)
    setOpen(false)
    setSearchQuery('')
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
            {selectedOffice ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {selectedOffice.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {selectedOffice.city}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Search className="h-4 w-4" />
                {placeholder}
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 max-h-[400px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск по названию, городу, адресу..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9"
            />
            <CommandList className="max-h-[350px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="text-sm text-muted-foreground">Загрузка офисов...</div>
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchQuery ? (
                      <div className="p-4 text-center">
                        <div className="text-sm text-muted-foreground">
                          Офисы не найдены по запросу "{searchQuery}"
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center">
                        <div className="text-sm text-muted-foreground">Начните вводить для поиска</div>
                      </div>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredOffices.map((office) => (
                      <CommandItem
                        key={office.id}
                        value={office.id}
                        onSelect={() => handleSelect(office.id)}
                        className="flex items-center gap-3 p-3"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value === office.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <Building className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {office.name}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span>{office.city}</span>
                              {office.address && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{office.address}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            ID: {office.id.slice(-6)}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {/* Показываем информацию о выбранном офисе */}
      {selectedOffice && (
        <div className="mt-2 text-xs text-muted-foreground">
          Выбран: {selectedOffice.name} ({selectedOffice.city})
        </div>
      )}
    </div>
  )
}
