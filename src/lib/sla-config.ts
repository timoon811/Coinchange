import { OperationDirection, RequestStatus } from '@prisma/client'
import { addMinutes, addHours, addDays } from 'date-fns'

// Конфигурация SLA для различных типов операций
export interface SLARule {
  direction: OperationDirection
  baseTimeMinutes: number // Базовое время в минутах
  urgentThresholdAmount?: number // Сумма для срочных заявок
  urgentTimeMinutes?: number // Время для срочных заявок
  workingHoursOnly?: boolean // Учитывать только рабочие часы
  escalationLevels?: {
    level: number
    timeMinutes: number
    notifyRoles: string[]
  }[]
}

// Настройки SLA по типам операций
export const SLA_RULES: Record<OperationDirection, SLARule> = {
  [OperationDirection.CRYPTO_TO_CASH]: {
    direction: OperationDirection.CRYPTO_TO_CASH,
    baseTimeMinutes: 60, // 1 час
    urgentThresholdAmount: 100000, // 100к рублей
    urgentTimeMinutes: 30, // 30 минут для крупных сумм
    workingHoursOnly: false,
    escalationLevels: [
      { level: 1, timeMinutes: 45, notifyRoles: ['CASHIER'] },
      { level: 2, timeMinutes: 75, notifyRoles: ['MANAGER'] },
      { level: 3, timeMinutes: 90, notifyRoles: ['ADMIN'] }
    ]
  },
  
  [OperationDirection.CASH_TO_CRYPTO]: {
    direction: OperationDirection.CASH_TO_CRYPTO,
    baseTimeMinutes: 45, // 45 минут
    urgentThresholdAmount: 500000, // 500к рублей
    urgentTimeMinutes: 20, // 20 минут для крупных сумм
    workingHoursOnly: false,
    escalationLevels: [
      { level: 1, timeMinutes: 30, notifyRoles: ['CASHIER'] },
      { level: 2, timeMinutes: 60, notifyRoles: ['MANAGER'] },
      { level: 3, timeMinutes: 75, notifyRoles: ['ADMIN'] }
    ]
  },
  
  [OperationDirection.CARD_TO_CRYPTO]: {
    direction: OperationDirection.CARD_TO_CRYPTO,
    baseTimeMinutes: 120, // 2 часа (требует дополнительных проверок)
    urgentThresholdAmount: 200000, // 200к рублей
    urgentTimeMinutes: 60, // 1 час для крупных сумм
    workingHoursOnly: true, // Только в рабочее время
    escalationLevels: [
      { level: 1, timeMinutes: 90, notifyRoles: ['CASHIER'] },
      { level: 2, timeMinutes: 150, notifyRoles: ['MANAGER'] },
      { level: 3, timeMinutes: 180, notifyRoles: ['ADMIN'] }
    ]
  },
  
  [OperationDirection.CRYPTO_TO_CARD]: {
    direction: OperationDirection.CRYPTO_TO_CARD,
    baseTimeMinutes: 90, // 1.5 часа
    urgentThresholdAmount: 300000, // 300к рублей
    urgentTimeMinutes: 45, // 45 минут для крупных сумм
    workingHoursOnly: true,
    escalationLevels: [
      { level: 1, timeMinutes: 60, notifyRoles: ['CASHIER'] },
      { level: 2, timeMinutes: 120, notifyRoles: ['MANAGER'] },
      { level: 3, timeMinutes: 150, notifyRoles: ['ADMIN'] }
    ]
  },
  
  [OperationDirection.CARD_TO_CASH]: {
    direction: OperationDirection.CARD_TO_CASH,
    baseTimeMinutes: 180, // 3 часа (банковские операции)
    urgentThresholdAmount: 100000, // 100к рублей
    urgentTimeMinutes: 120, // 2 часа для крупных сумм
    workingHoursOnly: true,
    escalationLevels: [
      { level: 1, timeMinutes: 120, notifyRoles: ['CASHIER'] },
      { level: 2, timeMinutes: 240, notifyRoles: ['MANAGER'] },
      { level: 3, timeMinutes: 300, notifyRoles: ['ADMIN'] }
    ]
  },
  
  [OperationDirection.CASH_TO_CARD]: {
    direction: OperationDirection.CASH_TO_CARD,
    baseTimeMinutes: 240, // 4 часа (банковские операции)
    urgentThresholdAmount: 150000, // 150к рублей
    urgentTimeMinutes: 180, // 3 часа для крупных сумм
    workingHoursOnly: true,
    escalationLevels: [
      { level: 1, timeMinutes: 180, notifyRoles: ['CASHIER'] },
      { level: 2, timeMinutes: 300, notifyRoles: ['MANAGER'] },
      { level: 3, timeMinutes: 360, notifyRoles: ['ADMIN'] }
    ]
  }
}

// Рабочее время
export const WORKING_HOURS = {
  start: 9, // 9:00
  end: 18,  // 18:00
  weekendMultiplier: 1.5, // Коэффициент для выходных
  timezone: 'Europe/Moscow'
}

// Приоритеты клиентов
export enum ClientPriority {
  VIP = 'VIP',     // Срочная обработка -50%
  HIGH = 'HIGH',   // Приоритетная обработка -25%
  NORMAL = 'NORMAL', // Стандартная обработка
  LOW = 'LOW'      // Низкий приоритет +50%
}

export const PRIORITY_MODIFIERS: Record<ClientPriority, number> = {
  [ClientPriority.VIP]: 0.5,    // -50%
  [ClientPriority.HIGH]: 0.75,  // -25%
  [ClientPriority.NORMAL]: 1.0, // без изменений
  [ClientPriority.LOW]: 1.5     // +50%
}

/**
 * Вычисляет SLA дедлайн для заявки
 */
export function calculateSLADeadline(
  direction: OperationDirection,
  amount: number,
  currency: string,
  clientPriority: ClientPriority = ClientPriority.NORMAL,
  createdAt: Date = new Date()
): Date {
  const rule = SLA_RULES[direction]
  
  // Определяем базовое время
  let timeMinutes = rule.baseTimeMinutes
  
  // Проверяем на срочность по сумме
  if (rule.urgentThresholdAmount && rule.urgentTimeMinutes) {
    // Конвертируем в рубли для сравнения (упрощенно)
    const amountInRub = currency === 'RUB' ? amount : amount * 50000 // примерный курс
    
    if (amountInRub >= rule.urgentThresholdAmount) {
      timeMinutes = rule.urgentTimeMinutes
    }
  }
  
  // Применяем модификатор приоритета клиента
  timeMinutes = Math.round(timeMinutes * PRIORITY_MODIFIERS[clientPriority])
  
  // Учитываем рабочие часы
  let deadline = addMinutes(createdAt, timeMinutes)
  
  if (rule.workingHoursOnly) {
    deadline = adjustForWorkingHours(deadline, createdAt)
  }
  
  return deadline
}

/**
 * Корректирует дедлайн с учетом рабочих часов
 */
function adjustForWorkingHours(deadline: Date, createdAt: Date): Date {
  const hour = deadline.getHours()
  const day = deadline.getDay() // 0 = воскресенье, 6 = суббота
  
  // Если попадает на выходные, переносим на понедельник
  if (day === 0 || day === 6) {
    const daysToMonday = day === 0 ? 1 : 2
    deadline = addDays(deadline, daysToMonday)
    deadline.setHours(WORKING_HOURS.start, 0, 0, 0)
  }
  // Если после рабочего времени, переносим на следующий рабочий день
  else if (hour >= WORKING_HOURS.end) {
    deadline = addDays(deadline, 1)
    deadline.setHours(WORKING_HOURS.start, 0, 0, 0)
  }
  // Если до рабочего времени, переносим на начало рабочего дня
  else if (hour < WORKING_HOURS.start) {
    deadline.setHours(WORKING_HOURS.start, 0, 0, 0)
  }
  
  return deadline
}

/**
 * Получает следующий уровень эскалации
 */
export function getNextEscalationLevel(
  direction: OperationDirection,
  currentMinutes: number
): { level: number; notifyRoles: string[] } | null {
  const rule = SLA_RULES[direction]
  
  if (!rule.escalationLevels) return null
  
  for (const escalation of rule.escalationLevels) {
    if (currentMinutes >= escalation.timeMinutes) {
      return escalation
    }
  }
  
  return null
}

/**
 * Проверяет, нужно ли отправить уведомление об эскалации
 */
export function shouldEscalate(
  direction: OperationDirection,
  timeElapsedMinutes: number,
  lastEscalationLevel: number = 0
): { shouldEscalate: boolean; level: number; notifyRoles: string[] } {
  const rule = SLA_RULES[direction]
  
  if (!rule.escalationLevels) {
    return { shouldEscalate: false, level: 0, notifyRoles: [] }
  }
  
  for (const escalation of rule.escalationLevels) {
    if (timeElapsedMinutes >= escalation.timeMinutes && escalation.level > lastEscalationLevel) {
      return {
        shouldEscalate: true,
        level: escalation.level,
        notifyRoles: escalation.notifyRoles
      }
    }
  }
  
  return { shouldEscalate: false, level: lastEscalationLevel, notifyRoles: [] }
}

/**
 * Получает настройки SLA для типа операции
 */
export function getSLARule(direction: OperationDirection): SLARule {
  return SLA_RULES[direction]
}

/**
 * Форматирует время до дедлайна в человекочитаемый вид
 */
export function formatTimeToDeadline(minutes: number): string {
  if (minutes <= 0) return 'Просрочено'
  
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  if (hours === 0) return `${mins}м`
  if (mins === 0) return `${hours}ч`
  
  return `${hours}ч ${mins}м`
}

/**
 * Определяет критичность SLA статуса
 */
export function getSLACriticality(
  isOverdue: boolean,
  timeToSLA: number | null
): 'critical' | 'warning' | 'normal' | 'good' {
  if (isOverdue) return 'critical'
  if (!timeToSLA) return 'normal'
  
  if (timeToSLA <= 15) return 'critical' // Меньше 15 минут
  if (timeToSLA <= 30) return 'warning'  // Меньше 30 минут
  if (timeToSLA <= 60) return 'normal'   // Меньше часа
  
  return 'good' // Больше часа
}

