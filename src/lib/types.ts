import { 
  UserRole, 
  RequestStatus, 
  OperationDirection, 
  NotificationType,
  CurrencyType,
  AccountType,
  OperationType,
  DepositType,
  AttachmentType
} from '@prisma/client'
import { z } from 'zod'

// Базовые схемы валидации пагинации
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
})

// Расширенная схема пагинации с сортировкой
export const paginationWithSortSchema = paginationSchema.extend({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Схема пагинации из URL параметров (строки)
export const paginationFromUrlSchema = z.object({
  page: z.string().optional().transform(val => parseInt(val || '1') || 1).pipe(z.number().int().min(1)),
  limit: z.string().optional().transform(val => parseInt(val || '20') || 20).pipe(z.number().int().min(1).max(100)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
})

// Типы для пагинации
export type PaginationParams = z.infer<typeof paginationSchema>
export type PaginationWithSortParams = z.infer<typeof paginationWithSortSchema>
export type PaginationFromUrlParams = z.infer<typeof paginationFromUrlSchema>

// Типы для API payloads
export interface AuthenticatedPayload {
  userId: string
  username: string
  role: UserRole
  officeIds?: string[]
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Типы для фильтров запросов
export interface RequestFilters {
  status?: RequestStatus[]
  direction?: OperationDirection[]
  officeId?: string[]
  assignedUserId?: string[]
  clientId?: string[]
  dateFrom?: Date
  dateTo?: Date
  search?: string
  currency?: string[]
  network?: string[]
}

// Типы для фильтров клиентов
export interface ClientFilters {
  search?: string
  tags?: string[]
  blocked?: boolean
  hasPhone?: boolean
  minRequests?: number
  maxRequests?: number
  minVolume?: number
  maxVolume?: number
  dateFrom?: Date
  dateTo?: Date
}

// Типы для фильтров уведомлений
export interface NotificationFilters {
  type?: NotificationType[]
  read?: boolean
  dateFrom?: Date
  dateTo?: Date
}

// Типы для обновлений
export interface UserUpdateData {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  password?: string
  role?: UserRole
  officeIds?: string[]
  isActive?: boolean
}

export interface OfficeUpdateData {
  name?: string
  city?: string
  address?: string
  phone?: string
  email?: string
  activeCurrencies?: string[]
  activeNetworks?: string[]
  isActive?: boolean
}

export interface RequestUpdateData {
  status?: RequestStatus
  assignedUserId?: string | null
  officeId?: string | null
  slaDeadline?: Date | null
}

export interface ClientUpdateData {
  username?: string
  firstName?: string
  lastName?: string
  phone?: string
  tags?: string[]
  notes?: string
  isBlocked?: boolean
}

// Типы для экспорта
export type ExportType = 'requests' | 'clients' | 'offices' | 'users'
export type ExportFormat = 'csv' | 'excel' | 'pdf'

// Типы для SLA
export type SLAStatus = 'active' | 'overdue' | 'completed' | 'cancelled'

// Типы для дашборда
export interface DashboardStats {
  kpi: {
    totalRequests: number
    newRequests: number
    inProgressRequests: number
    completedRequests: number
    overdueRequests: number
    totalVolume: number
    averageCompletionTime: number
    conversionRate: number
  }
  statusStats: Array<{
    status: RequestStatus
    count: number
  }>
  directionStats: Array<{
    direction: OperationDirection
    count: number
    volume: number
  }>
  currencyStats: Array<{
    currency: string
    count: number
    volume: number
  }>
  officeStats: Array<{
    officeId: string
    count: number
    volume: number
  }>
  dailyTrend: Array<{
    date: string
    requests: number
    volume: number
  }>
  recentRequests: Array<{
    id: string
    requestId: string
    client: {
      firstName: string | null
      lastName: string | null
      username: string | null
    }
    direction: OperationDirection
    amount: number
    currency: string
    office: string
    status: RequestStatus
    createdAt: string
  }>
  activeCashiers: number
  period: string
}

// Типы для Telegram webhook
export interface TelegramWebhookPayload {
  request_id: string
  client: {
    telegram_user_id: number
    username?: string
    first_name?: string
    last_name?: string
    phone?: string
    language_code?: string
  }
  operation: {
    direction: 'CryptoToCash' | 'CashToCrypto' | 'CardToCrypto' | 'CryptoToCard' | 'CardToCash' | 'CashToCard'
    from_currency: string
    from_network?: 'ETH' | 'TRON' | 'BSC' | 'TON' | 'SOL' | 'BTC' | 'POLYGON' | 'AVALANCHE'
    to_currency: string
    expected_amount_from: number
    expected_amount_to?: number
    rate_locked_ttl_sec?: number
  }
  requisites: {
    wallet_address?: string
    card_number?: string
    card_masked?: string
    bank_name?: string
    office_id?: string
    timeslot?: string
    extra_data?: Record<string, unknown>
  }
  attachments?: Array<{
    filename: string
    url: string
    type: 'receipt' | 'screenshot' | 'document'
  }>
  comment?: string
  meta?: {
    source: string
    locale: string
  }
}

// Типы для аудита
export interface AuditLogData {
  actorId: string
  entityType: string
  entityId: string
  action: string
  oldValues?: Record<string, unknown>
  newValues?: Record<string, unknown>
}

// Типы для rate limiting
export interface RateLimitEntry {
  count: number
  resetTime: number
}

// Типы для компонентов
export interface SelectOption {
  value: string
  label: string
}

export interface NotificationItem {
  id: string
  type: NotificationType
  title: string
  message: string
  payload?: Record<string, unknown>
  isRead: boolean
  createdAt: Date
}

// Схемы валидации Zod
export const loginSchema = z.object({
  username: z.string().min(1, 'Имя пользователя обязательно').max(50, 'Имя пользователя слишком длинное'),
  password: z.string().min(6, 'Пароль должен содержать минимум 6 символов'),
})

export const userCreateSchema = z.object({
  username: z.string().min(3, 'Имя пользователя минимум 3 символа').max(50),
  email: z.string().email('Неверный формат email').optional(),
  firstName: z.string().min(1, 'Имя обязательно').max(50),
  lastName: z.string().max(50).optional(),
  password: z.string().min(6, 'Пароль минимум 6 символов'),
  role: z.nativeEnum(UserRole),
  officeIds: z.array(z.string()).default([]),
})

export const userUpdateSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email().optional(),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().max(50).optional(),
  password: z.string().min(6).optional(),
  role: z.nativeEnum(UserRole).optional(),
  officeIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
})

export const requestFiltersSchema = z.object({
  status: z.array(z.nativeEnum(RequestStatus)).optional(),
  direction: z.array(z.nativeEnum(OperationDirection)).optional(),
  officeId: z.array(z.string()).optional(),
  assignedUserId: z.array(z.string()).optional(),
  clientId: z.array(z.string()).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  search: z.string().optional(),
  currency: z.array(z.string()).optional(),
  network: z.array(z.string()).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
})

export const requestUpdateSchema = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  assignedUserId: z.string().nullable().optional(),
  officeId: z.string().nullable().optional(),
  slaDeadline: z.string().datetime().nullable().optional(),
  isOverdue: z.boolean().optional(),
})

export const officeCreateSchema = z.object({
  name: z.string().min(1, 'Название обязательно').max(100),
  city: z.string().min(1, 'Город обязателен').max(100),
  address: z.string().min(1, 'Адрес обязателен').max(200),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  activeCurrencies: z.array(z.string()).default([]),
  activeNetworks: z.array(z.string()).default([]),
  isActive: z.boolean().default(true),
})

export const clientUpdateSchema = z.object({
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isBlocked: z.boolean().optional(),
})

// Типы для валидированных данных
export type LoginInput = z.infer<typeof loginSchema>
export type UserCreateInput = z.infer<typeof userCreateSchema>
export type UserUpdateInput = z.infer<typeof userUpdateSchema>
export type RequestFiltersInput = z.infer<typeof requestFiltersSchema>
export type RequestUpdateInput = z.infer<typeof requestUpdateSchema>
export type OfficeCreateInput = z.infer<typeof officeCreateSchema>
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>

// Типы для системы учета
export interface CurrencyData {
  id: string
  code: string
  name: string
  symbol?: string
  type: CurrencyType
  decimals: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface AccountData {
  id: string
  officeId: string
  currencyId: string
  type: AccountType
  name: string
  description?: string
  balance: number
  initialBalance: number
  minBalance?: number
  maxBalance?: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  currency?: CurrencyData
  office?: {
    id: string
    name: string
  }
}

export interface ExchangeRateData {
  id: string
  currencyId: string
  baseCurrencyId?: string
  purchaseRate: number
  sellRate: number
  defaultMargin: number
  rateDate: Date
  setBy: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  currency?: CurrencyData
  setter?: {
    id: string
    firstName: string
    lastName?: string
  }
}

export interface OperationData {
  id: string
  officeId: string
  type: OperationType
  fromAccountId?: string
  toAccountId?: string
  amount: number
  currencyId: string
  exchangeRate?: number
  requestId?: string
  clientId?: string
  categoryId?: string
  description?: string
  notes?: string
  performedBy: string
  createdAt: Date
  updatedAt: Date
  fromAccount?: AccountData
  toAccount?: AccountData
  currency?: CurrencyData
  request?: {
    id: string
    requestId: string
  }
  client?: {
    id: string
    firstName?: string
    lastName?: string
  }
  category?: OperationCategoryData
  performer?: {
    id: string
    firstName: string
    lastName?: string
  }
}

export interface OperationCategoryData {
  id: string
  name: string
  description?: string
  type: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface DepositData {
  id: string
  type: DepositType
  clientId?: string
  officeId: string
  currencyId: string
  amount: number
  interestRate?: number
  term?: number
  startDate: Date
  endDate?: Date
  description?: string
  notes?: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  client?: {
    id: string
    firstName?: string
    lastName?: string
  }
  office?: {
    id: string
    name: string
  }
  currency?: CurrencyData
}

// Фильтры для системы учета
export interface OperationFilters {
  officeId?: string[]
  type?: OperationType[]
  currencyId?: string[]
  categoryId?: string[]
  clientId?: string[]
  dateFrom?: Date
  dateTo?: Date
  amountFrom?: number
  amountTo?: number
  search?: string
}

export interface AccountFilters {
  officeId?: string[]
  currencyId?: string[]
  type?: AccountType[]
  isActive?: boolean
  hasLowBalance?: boolean
  hasHighBalance?: boolean
}

export interface DepositFilters {
  type?: DepositType[]
  officeId?: string[]
  currencyId?: string[]
  clientId?: string[]
  isActive?: boolean
  expiringDays?: number
  dateFrom?: Date
  dateTo?: Date
}

// Схемы валидации для системы учета
export const currencyCreateSchema = z.object({
  code: z.string().min(1, 'Код валюты обязателен').max(10),
  name: z.string().min(1, 'Название валюты обязательно').max(100),
  symbol: z.string().max(10).optional(),
  type: z.nativeEnum(CurrencyType),
  decimals: z.number().int().min(0).max(18).default(8),
  isActive: z.boolean().default(true),
})

export const accountCreateSchema = z.object({
  officeId: z.string().min(1, 'Офис обязателен'),
  currencyId: z.string().min(1, 'Валюта обязательна'),
  type: z.nativeEnum(AccountType),
  name: z.string().min(1, 'Название счета обязательно').max(100),
  description: z.string().max(500).optional(),
  initialBalance: z.number().min(0).default(0),
  minBalance: z.number().min(0).optional(),
  maxBalance: z.number().min(0).optional(),
})

export const exchangeRateCreateSchema = z.object({
  currencyId: z.string().min(1, 'Валюта обязательна'),
  baseCurrencyId: z.string().optional(),
  purchaseRate: z.number().positive('Курс закупки должен быть положительным').refine(
    (val) => val <= 999999999, 
    'Курс закупки слишком большой'
  ),
  defaultMargin: z.number().min(0, 'Маржа не может быть отрицательной').max(100, 'Маржа не может превышать 100%').default(1.0),
  rateDate: z.string().datetime().optional(),
})

export const operationCreateSchema = z.object({
  officeId: z.string().min(1, 'Офис обязателен'),
  type: z.nativeEnum(OperationType),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  amount: z.number().positive('Сумма должна быть положительной'),
  currencyId: z.string().min(1, 'Валюта обязательна'),
  exchangeRate: z.number().positive().optional(),
  requestId: z.string().optional(),
  clientId: z.string().optional(),
  categoryId: z.string().optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

export const depositCreateSchema = z.object({
  type: z.nativeEnum(DepositType),
  clientId: z.string().optional(),
  officeId: z.string().min(1, 'Офис обязателен'),
  currencyId: z.string().min(1, 'Валюта обязательна'),
  amount: z.number().positive('Сумма должна быть положительной'),
  interestRate: z.number().min(0).max(100).optional(),
  term: z.number().int().min(1).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  description: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

// Типы для отчетов
export interface ProfitReportData {
  period: string
  grossProfit: number
  netProfit: number
  revenue: number
  expenses: number
  operationsCount: number
  topCurrencies: Array<{
    currency: string
    profit: number
    volume: number
  }>
  dailyTrend: Array<{
    date: string
    profit: number
    volume: number
  }>
}

export interface TurnoverReportData {
  period: string
  totalTurnover: number
  currencies: Array<{
    currency: string
    turnover: number
    operationsCount: number
  }>
  offices: Array<{
    officeId: string
    officeName: string
    turnover: number
  }>
  clients: Array<{
    clientId: string
    clientName: string
    turnover: number
  }>
  dailyTrend: Array<{
    date: string
    turnover: number
    operationsCount: number
  }>
}

// Дополнительные схемы валидации
export const notificationCreateSchema = z.object({
  userId: z.string().min(1, 'ID пользователя обязателен'),
  type: z.nativeEnum(NotificationType),
  title: z.string().min(1, 'Заголовок обязателен').max(200),
  message: z.string().min(1, 'Сообщение обязательно').max(1000),
  data: z.any().optional(),
  read: z.boolean().default(false),
})

export const auditLogCreateSchema = z.object({
  actorId: z.string().min(1, 'ID актора обязателен'),
  entityType: z.string().min(1, 'Тип сущности обязателен'),
  entityId: z.string().min(1, 'ID сущности обязателен'),
  action: z.string().min(1, 'Действие обязательно'),
  oldValues: z.any().optional(),
  newValues: z.any().optional(),
  metadata: z.any().optional(),
})

export const attachmentCreateSchema = z.object({
  requestId: z.string().min(1, 'ID заявки обязателен'),
  filename: z.string().min(1, 'Имя файла обязательно'),
  originalName: z.string().min(1, 'Оригинальное имя файла обязательно'),
  fileUrl: z.string().url('Некорректный URL файла'),
  fileSize: z.number().min(0, 'Размер файла не может быть отрицательным'),
  mimeType: z.string().min(1, 'MIME тип обязателен'),
  type: z.nativeEnum(AttachmentType),
  uploadedBy: z.string().min(1, 'ID загрузившего обязателен'),
})

export const commentCreateSchema = z.object({
  requestId: z.string().min(1, 'ID заявки обязателен'),
  authorId: z.string().min(1, 'ID автора обязателен'),
  text: z.string().min(1, 'Текст комментария обязателен').max(2000),
  isInternal: z.boolean().default(false),
})

// Схемы валидации для фильтров
export const clientFiltersSchema = z.object({
  search: z.string().optional(),
  tags: z.array(z.string()).optional(),
  blocked: z.boolean().optional(),
  hasPhone: z.boolean().optional(),
  minRequests: z.number().int().min(0).optional(),
  maxRequests: z.number().int().min(0).optional(),
  minVolume: z.number().min(0).optional(),
  maxVolume: z.number().min(0).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(paginationWithSortSchema)

export const notificationFiltersSchema = z.object({
  type: z.array(z.nativeEnum(NotificationType)).optional(),
  read: z.boolean().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).merge(paginationWithSortSchema)

// Схемы валидации для отчетов
export const reportFiltersSchema = z.object({
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  period: z.enum(['1d', '7d', '30d', 'custom']).default('7d'),
  officeId: z.string().optional(),
  currencyId: z.string().optional(),
})

// Типы для экспорта
export type ExportType = 'requests' | 'clients' | 'offices' | 'users'
export type ExportFormat = 'csv' | 'xlsx' | 'pdf'

export const exportSchema = z.object({
  type: z.enum(['requests', 'clients', 'offices', 'users']),
  format: z.enum(['csv', 'xlsx', 'pdf']).default('csv'),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  filters: z.any().optional(),
})

// Схемы для прав доступа
export const permissionSchema = z.object({
  name: z.string().min(1, 'Название права обязательно').max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['PAGE_ACCESS', 'ACTION', 'FEATURE']),
  resource: z.enum([
    // Страницы
    'DASHBOARD', 'REQUESTS', 'CLIENTS', 'ACCOUNTING', 'ANALYTICS', 
    'REPORTS', 'SETTINGS', 'SLA', 'OFFICES', 'USERS', 'SYSTEM',
    // Подстраницы бухгалтерии
    'ACCOUNTS', 'CURRENCIES', 'DEPOSITS', 'EXCHANGE_RATES', 'OPERATIONS',
    // Действия
    'CREATE_REQUEST', 'EDIT_REQUEST', 'DELETE_REQUEST', 'ASSIGN_REQUEST',
    'CREATE_CLIENT', 'EDIT_CLIENT', 'DELETE_CLIENT',
    'CREATE_OPERATION', 'EDIT_OPERATION', 'DELETE_OPERATION',
    'CREATE_USER', 'EDIT_USER', 'DELETE_USER',
    'MANAGE_RATES', 'MANAGE_ACCOUNTS', 'MANAGE_OFFICES',
    'VIEW_REPORTS', 'EXPORT_REPORTS',
    'SYSTEM_SETTINGS', 'COMMISSION_RULES',
    // Функционал
    'BULK_OPERATIONS', 'ADVANCED_SEARCH', 'AUDIT_LOGS'
  ]),
  conditions: z.any().optional(),
  isActive: z.boolean().default(true),
})

export const rolePermissionSchema = z.object({
  role: z.enum(['ADMIN', 'CASHIER']),
  permissionId: z.string().min(1, 'ID права обязательно'),
  restrictions: z.any().optional(),
  isActive: z.boolean().default(true),
})

export const permissionUpdateSchema = permissionSchema.partial()
export const rolePermissionUpdateSchema = rolePermissionSchema.partial()

export type Permission = z.infer<typeof permissionSchema>
export type RolePermission = z.infer<typeof rolePermissionSchema>
export type PermissionUpdate = z.infer<typeof permissionUpdateSchema>
export type RolePermissionUpdate = z.infer<typeof rolePermissionUpdateSchema>

// Типы для бэкапа базы данных
export interface BackupConfig {
  maxBackups?: number
  compressionEnabled?: boolean
  scheduleEnabled?: boolean
  scheduleHour?: number
  excludedTables?: string[]
}

export interface BackupResult {
  success: boolean
  filePath?: string
  size?: number
  duration?: number
  error?: string
}

export interface BackupStats {
  totalBackups: number
  totalSizeMB: number
  oldestBackup?: Date
  newestBackup?: Date
  nextScheduledBackup?: Date
}

// Типы для WebSocket уведомлений
export interface WebSocketMessage {
  event: string
  data: any
  timestamp: Date
  type: 'user_notification' | 'role_notification' | 'office_notification' | 'global_notification'
  senderId?: string
  senderRole?: UserRole
}

export interface ConnectionStats {
  totalConnections: number
  usersByRole: Record<UserRole, number>
  users: Array<{
    userId: string
    role: UserRole
    connectedAt: Date
    officeIds?: string[]
  }>
}

// Типы для валидированных данных
export type NotificationCreateInput = z.infer<typeof notificationCreateSchema>
export type AuditLogCreateInput = z.infer<typeof auditLogCreateSchema>
export type AttachmentCreateInput = z.infer<typeof attachmentCreateSchema>
export type CommentCreateInput = z.infer<typeof commentCreateSchema>
export type ClientFiltersInput = z.infer<typeof clientFiltersSchema>
export type NotificationFiltersInput = z.infer<typeof notificationFiltersSchema>
export type ReportFiltersInput = z.infer<typeof reportFiltersSchema>
export type ExportInput = z.infer<typeof exportSchema>

// Типы для валидированных данных системы учета
export type CurrencyCreateInput = z.infer<typeof currencyCreateSchema>
export type AccountCreateInput = z.infer<typeof accountCreateSchema>
export type ExchangeRateCreateInput = z.infer<typeof exchangeRateCreateSchema>
export type OperationCreateInput = z.infer<typeof operationCreateSchema>
export type DepositCreateInput = z.infer<typeof depositCreateSchema>
