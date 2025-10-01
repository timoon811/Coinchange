"use client"

import { useState, useEffect, useMemo } from 'react'
import { useApi } from '@/hooks/use-api'
import { Check, ChevronsUpDown, Search, User } from 'lucide-react'
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

interface Client {
  id: string
  username: string
  firstName: string
  lastName: string
  phone: string | null
}

interface ClientSearchSelectProps {
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function ClientSearchSelect({
  value,
  onValueChange,
  placeholder = "Найдите клиента...",
  disabled = false,
  className
}: ClientSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [clients, setClients] = useState<Client[]>([])
  const [allClients, setAllClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { execute: fetchClients } = useApi<{data: Client[]}>()

  // Загружаем всех клиентов при первом открытии
  useEffect(() => {
    if (open && allClients.length === 0) {
      loadAllClients()
    }
  }, [open])

  const loadAllClients = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchClients('/api/clients?limit=100')
      console.log('ClientSearchSelect: API result:', result) // Debug log
      if (result && Array.isArray(result)) {
        setAllClients(result)
        setClients(result.slice(0, 20)) // Показываем первые 20
      } else {
        setError('Не удалось загрузить список клиентов')
      }
    } catch (error) {
      console.error('Failed to load clients:', error)
      setError('Ошибка загрузки клиентов. Проверьте авторизацию.')
    } finally {
      setLoading(false)
    }
  }

  // Фильтрация клиентов с debounce
  const filteredClients = useMemo(() => {
    if (!searchQuery) {
      return allClients.slice(0, 2) // Показываем только 2 клиента без поиска
    }

    const query = searchQuery.toLowerCase()
    return allClients.filter(client => 
      client.firstName?.toLowerCase().includes(query) ||
      client.lastName?.toLowerCase().includes(query) ||
      client.username?.toLowerCase().includes(query)
    ).slice(0, 5) // Ограничиваем результаты поиска до 5
  }, [allClients, searchQuery])

  const selectedClient = allClients.find(client => client.id === value)

  const handleSelect = (clientId: string) => {
    onValueChange(clientId)
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
            {selectedClient ? (
              <div className="flex items-center gap-2 min-w-0 flex-1 justify-start">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                  <div className="font-medium truncate w-full text-left">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate w-full text-left">
                    @{selectedClient.username}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground min-w-0 flex-1 justify-start">
                <Search className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-left">{placeholder}</span>
              </div>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 max-h-[200px]" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск по имени или username..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9"
            />
            <CommandList className="max-h-[150px] overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center">
                  <div className="text-sm text-muted-foreground">Загрузка клиентов...</div>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <div className="text-sm text-red-500 mb-2">{error}</div>
                  <div className="text-xs text-muted-foreground">
                    Убедитесь, что вы авторизованы в системе
                  </div>
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchQuery ? (
                      <div className="p-3 text-center">
                        <div className="text-sm text-muted-foreground">
                          Клиенты не найдены по запросу "{searchQuery}"
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center">
                        <div className="text-sm text-muted-foreground">Начните вводить для поиска</div>
                      </div>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {filteredClients.map((client) => (
                      <CommandItem
                        key={client.id}
                        value={client.id}
                        onSelect={() => handleSelect(client.id)}
                        className="flex items-start gap-2 p-2"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4 mt-0.5",
                            value === client.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="font-medium text-left">
                            {client.firstName} {client.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground text-left">
                            @{client.username}
                          </div>
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
    </div>
  )
}

