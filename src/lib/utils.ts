import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Форматирование криптовалют
export function formatCrypto(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

// Валидация адреса кошелька
export function validateWalletAddress(address: string, currency: string): boolean {
  if (!address || address.trim().length === 0) return false
  
  // Базовые проверки для разных валют
  switch (currency.toUpperCase()) {
    case 'BTC':
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) || 
             /^bc1[a-z0-9]{39,59}$/.test(address)
    case 'ETH':
    case 'USDT':
    case 'USDC':
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    case 'LTC':
      return /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(address)
    case 'DOGE':
      return /^D{1}[5-9A-HJ-NP-U]{1}[1-9A-HJ-NP-Za-km-z]{32}$/.test(address)
    default:
      return address.length >= 10 && address.length <= 100
  }
}

// Получение цвета валюты
export function getCurrencyColor(currency: string): string {
  const colors: Record<string, string> = {
    'BTC': 'text-orange-500',
    'ETH': 'text-blue-500',
    'USDT': 'text-green-500',
    'USDC': 'text-blue-600',
    'LTC': 'text-gray-500',
    'DOGE': 'text-yellow-500',
    'RUB': 'text-red-500',
  }
  return colors[currency.toUpperCase()] || 'text-gray-500'
}

// Получение иконки валюты
export function getCurrencyIcon(currency: string): string {
  const icons: Record<string, string> = {
    'BTC': '₿',
    'ETH': 'Ξ',
    'USDT': '₮',
    'USDC': '₵',
    'LTC': 'Ł',
    'DOGE': 'Ð',
    'RUB': '₽',
  }
  return icons[currency.toUpperCase()] || currency.toUpperCase()
}
