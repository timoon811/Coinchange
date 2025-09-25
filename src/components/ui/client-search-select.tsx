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

  const { execute: fetchClients } = useApi<{data: Client[]}>()

  // Загружаем всех клиентов при первом открытии
  useEffect(() => {
    if (open && allClients.length === 0) {
      loadAllClients()
    }
  }, [open])

  const loadAllClients = async () => {
    setLoading(true)
    try {
      const result = await fetchClients('/api/clients?limit=100')
      if (result?.data && Array.isArray(result.data)) {
        setAllClients(result.data)
        setClients(result.data.slice(0, 20)) // Показываем первые 20
      }
    } catch (error) {
      console.error('Failed to load clients:', error)
    } finally {
      setLoading(false)
    }
  }

  // Фильтрация клиентов с debounce
  const filteredClients = useMemo(() => {
    if (!searchQuery) {
      return allClients.slice(0, 20)
    }

    const query = searchQuery.toLowerCase()
    return allClients.filter(client => 
      client.firstName?.toLowerCase().includes(query) ||
      client.lastName?.toLowerCase().includes(query) ||
      client.username?.toLowerCase().includes(query) ||
      client.phone?.includes(query) ||
      client.id.toLowerCase().includes(query)
    ).slice(0, 10) // Ограничиваем результаты поиска
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
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex flex-col items-start min-w-0 flex-1">
                  <div className="font-medium truncate">
                    {selectedClient.firstName} {selectedClient.lastName}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    @{selectedClient.username}
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
        <PopoverContent className="w-full p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Поиск по имени, username, телефону..."
              value={searchQuery}
              onValueChange={setSearchQuery}
              className="h-9"
            />
            <CommandList>
              {loading ? (
                <div className="p-4 text-center">
                  <div className="text-sm text-muted-foreground">Загрузка клиентов...</div>
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    {searchQuery ? (
                      <div className="p-4 text-center">
                        <div className="text-sm text-muted-foreground">
                          Клиенты не найдены по запросу "{searchQuery}"
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center">
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
                        className="flex items-center gap-3 p-3"
                      >
                        <Check
                          className={cn(
                            "h-4 w-4",
                            value === client.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">
                              {client.firstName} {client.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <span>@{client.username}</span>
                              {client.phone && (
                                <>
                                  <span>•</span>
                                  <span>{client.phone}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            ID: {client.id.slice(-6)}
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
      
      {/* Показываем информацию о выбранном клиенте */}
      {selectedClient && (
        <div className="mt-2 text-xs text-muted-foreground">
          Выбран: {selectedClient.firstName} {selectedClient.lastName} (@{selectedClient.username})
        </div>
      )}
    </div>
  )
}

