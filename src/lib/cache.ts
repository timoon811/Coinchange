import { RequestStatus, OperationDirection } from '@prisma/client'

// Типы для кеширования
export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

export class CacheService {
  private static cache = new Map<string, CacheEntry<any>>()
  private static readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 минут

  // Получить данные из кеша
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key)

    if (!entry) {
      return null
    }

    // Проверяем срок действия
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  // Сохранить данные в кеш
  static set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
    }

    this.cache.set(key, entry)
  }

  // Удалить данные из кеша
  static delete(key: string): void {
    this.cache.delete(key)
  }

  // Очистить весь кеш
  static clear(): void {
    this.cache.clear()
  }

  // Получить или установить данные (паттерн cache-aside)
  static async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL
  ): Promise<T> {
    // Пытаемся получить из кеша
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Если нет в кеше, получаем данные
    const data = await fetcher()

    // Сохраняем в кеш
    this.set(key, data, ttl)

    return data
  }

  // Генерация ключей для различных типов данных
  static generateKey(type: string, params: Record<string, any>): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|')

    return `${type}:${paramString}`
  }

  // Специфические ключи для разных сущностей
  static keys = {
    dashboardStats: (period: string) => `dashboard:stats:${period}`,
    userById: (id: string) => `user:id:${id}`,
    officeById: (id: string) => `office:id:${id}`,
    clientById: (id: string) => `client:id:${id}`,
    requestById: (id: string) => `request:id:${id}`,
    requestsList: (filters: any) => CacheService.generateKey('requests:list', filters),
    notificationsByUser: (userId: string) => `notifications:user:${userId}`,
    auditLog: (entityType: string, entityId: string) => `audit:${entityType}:${entityId}`,
  }

  // Очистка устаревших записей
  static cleanup(): void {
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Получение статистики кеша
  static getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

// Специализированный сервис для кеширования курсов валют
export class ExchangeRateCache {
  private static readonly EXCHANGE_RATE_TTL = 60 * 1000 // 1 минута для курсов валют
  private static readonly POPULAR_PAIRS = [
    ['USD', 'RUB'],
    ['EUR', 'RUB'], 
    ['BTC', 'USD'],
    ['ETH', 'USD'],
    ['USDT', 'USD'],
    ['USDC', 'USD'],
  ]

  // Получение курса валюты с кешированием
  static async getRate(fromCurrency: string, toCurrency: string): Promise<number | null> {
    const key = CacheService.generateKey('exchange_rate', { from: fromCurrency, to: toCurrency })
    
    return await CacheService.getOrSet(
      key,
      async () => {
        try {
          // Импортируем prisma внутри функции для избежания циклических зависимостей
          const { prisma } = await import('./prisma')
          
          console.log(`Fetching exchange rate from DB: ${fromCurrency} -> ${toCurrency}`)
          
          // Получаем курсы из базы данных
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          // Ищем валюты по кодам
          const [fromCurrencyData, toCurrencyData] = await Promise.all([
            prisma.currency.findFirst({ where: { code: fromCurrency, isActive: true } }),
            prisma.currency.findFirst({ where: { code: toCurrency, isActive: true } })
          ])
          
          if (!fromCurrencyData || !toCurrencyData) {
            console.log(`Currency not found: ${fromCurrency} or ${toCurrency}`)
            return null
          }
          
          // Если это одна и та же валюта, возвращаем 1
          if (fromCurrency === toCurrency) {
            return 1.0
          }
          
          // Ищем прямой курс from -> to
          const directRate = await prisma.exchangeRate.findFirst({
            where: {
              currencyId: fromCurrencyData.id,
              isActive: true,
              rateDate: { lte: today }
            },
            orderBy: { rateDate: 'desc' },
            include: { currency: true }
          })
          
          if (directRate && toCurrency === 'USDT') {
            // Прямой курс к USDT (используем курс продажи)
            return directRate.sellRate
          }
          
          if (directRate && fromCurrency === 'USDT') {
            // Обратный курс от USDT
            return 1 / directRate.purchaseRate
          }
          
          // Ищем курс через USDT (базовая валюта)
          const [fromToUSDT, toToUSDT] = await Promise.all([
            prisma.exchangeRate.findFirst({
              where: {
                currencyId: fromCurrencyData.id,
                isActive: true,
                rateDate: { lte: today }
              },
              orderBy: { rateDate: 'desc' }
            }),
            prisma.exchangeRate.findFirst({
              where: {
                currencyId: toCurrencyData.id,
                isActive: true,
                rateDate: { lte: today }
              },
              orderBy: { rateDate: 'desc' }
            })
          ])
          
          if (fromToUSDT && toToUSDT) {
            // Пересчитываем через USDT: from -> USDT -> to
            const fromToUSDTRate = fromToUSDT.sellRate
            const USDTToToRate = 1 / toToUSDT.purchaseRate
            return fromToUSDTRate * USDTToToRate
          }
          
          console.log(`No exchange rate found for ${fromCurrency} -> ${toCurrency}`)
          return null
          
        } catch (error) {
          console.error(`Error fetching exchange rate ${fromCurrency} -> ${toCurrency}:`, error)
          return null
        }
      },
      this.EXCHANGE_RATE_TTL
    )
  }

  // Инвалидация курсов валют (удаление из кеша)
  static invalidateRates(currencies?: string[]): void {
    if (currencies && currencies.length > 0) {
      // Удаляем курсы для конкретных валют
      for (const currency of currencies) {
        const pattern = new RegExp(`exchange_rate:.*${currency}`)
        const keysToDelete = Array.from(CacheService['cache'].keys()).filter(key => pattern.test(key))
        keysToDelete.forEach(key => CacheService.delete(key))
      }
    } else {
      // Удаляем все курсы валют
      const exchangeRateKeys = Array.from(CacheService['cache'].keys()).filter(key => 
        key.startsWith('exchange_rate:')
      )
      exchangeRateKeys.forEach(key => CacheService.delete(key))
    }
  }

  // Предварительная загрузка популярных курсов
  static async preloadPopularRates(): Promise<void> {
    console.log('Preloading popular exchange rates...')
    
    const promises = this.POPULAR_PAIRS.map(async ([from, to]) => {
      try {
        await this.getRate(from, to)
        return { success: true, pair: `${from}/${to}` }
      } catch (error) {
        console.error(`Failed to preload rate for ${from}/${to}:`, error)
        return { success: false, pair: `${from}/${to}`, error }
      }
    })

    const results = await Promise.allSettled(promises)
    const successful = results.filter(r => r.status === 'fulfilled').length
    
    console.log(`Exchange rates preload completed: ${successful}/${this.POPULAR_PAIRS.length} successful`)
  }

  // Получение всех закешированных курсов
  static getCachedRates(): Array<{pair: string, rate: number, age: number}> {
    const rates: Array<{pair: string, rate: number, age: number}> = []
    const now = Date.now()
    
    for (const [key, entry] of CacheService['cache'].entries()) {
      if (key.startsWith('exchange_rate:')) {
        const rate = entry.data
        if (rate !== null) {
          // Извлекаем валютную пару из ключа
          const match = key.match(/from:(\w+)\|to:(\w+)/)
          if (match) {
            const [, from, to] = match
            rates.push({
              pair: `${from}/${to}`,
              rate,
              age: now - entry.timestamp
            })
          }
        }
      }
    }
    
    return rates.sort((a, b) => a.pair.localeCompare(b.pair))
  }

  // Получение актуального курса для расчетов
  static async getActiveRate(currencyCode: string, baseCode: string = 'USDT'): Promise<{purchaseRate: number, sellRate: number} | null> {
    try {
      const { prisma } = await import('./prisma')
      
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const currency = await prisma.currency.findFirst({
        where: { code: currencyCode, isActive: true }
      })
      
      if (!currency) return null
      
      const rate = await prisma.exchangeRate.findFirst({
        where: {
          currencyId: currency.id,
          isActive: true,
          rateDate: { lte: today }
        },
        orderBy: { rateDate: 'desc' }
      })
      
      if (!rate) return null
      
      return {
        purchaseRate: parseFloat(rate.purchaseRate.toString()),
        sellRate: parseFloat(rate.sellRate.toString())
      }
    } catch (error) {
      console.error(`Error fetching active rate for ${currencyCode}:`, error)
      return null
    }
  }

  // Статистика по курсам валют в кеше
  static getStats(): {total: number, fresh: number, stale: number, popular: number} {
    const now = Date.now()
    let total = 0
    let fresh = 0
    let stale = 0
    let popular = 0
    
    for (const [key, entry] of CacheService['cache'].entries()) {
      if (key.startsWith('exchange_rate:')) {
        total++
        const age = now - entry.timestamp
        
        if (age < this.EXCHANGE_RATE_TTL) {
          fresh++
        } else {
          stale++
        }
        
        // Проверяем является ли курс популярным
        const match = key.match(/from:(\w+)\|to:(\w+)/)
        if (match) {
          const [, from, to] = match
          const isPopular = this.POPULAR_PAIRS.some(([f, t]) => 
            (f === from && t === to) || (f === to && t === from)
          )
          if (isPopular) popular++
        }
      }
    }
    
    return { total, fresh, stale, popular }
  }
}

// Обновляем основной CacheService для добавления методов курсов валют
CacheService.keys = {
  ...CacheService.keys,
  exchangeRate: (from: string, to: string) => CacheService.generateKey('exchange_rate', { from, to }),
  exchangeRatesStats: () => 'exchange_rates:stats',
  currencyList: () => 'currencies:list',
}

// Автоматическая очистка кеша каждые 10 минут
if (typeof global !== 'undefined') {
  setInterval(() => {
    CacheService.cleanup()
  }, 10 * 60 * 1000)

  // Предварительная загрузка популярных курсов при старте сервера
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      ExchangeRateCache.preloadPopularRates().catch(console.error)
    }, 5000) // Загружаем через 5 секунд после старта
  }
}
