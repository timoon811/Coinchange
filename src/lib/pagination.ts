import { NextRequest } from 'next/server'
import { paginationFromUrlSchema, type PaginationFromUrlParams } from './types'
import { logger } from './logger'

/**
 * Валидирует и извлекает параметры пагинации из URL
 */
export function validatePaginationFromUrl(request: NextRequest): PaginationFromUrlParams {
  const { searchParams } = new URL(request.url)
  
  const params = {
    page: searchParams.get('page'),
    limit: searchParams.get('limit'),
    sortBy: searchParams.get('sortBy'),
    sortOrder: searchParams.get('sortOrder') as 'asc' | 'desc' | undefined,
  }

  try {
    const validationResult = paginationFromUrlSchema.parse(params)
    
    logger.debug('Pagination parameters validated', {
      original: params,
      validated: validationResult,
      url: request.url
    })
    
    return validationResult
  } catch (error) {
    logger.warn('Invalid pagination parameters, using defaults', {
      params,
      error,
      url: request.url
    })
    
    // Возвращаем значения по умолчанию при ошибке валидации
    return {
      page: 1,
      limit: 20,
      sortBy: params.sortBy || undefined,
      sortOrder: 'desc'
    }
  }
}

/**
 * Вычисляет offset для базы данных
 */
export function calculateOffset(page: number, limit: number): number {
  return (page - 1) * limit
}

/**
 * Создает объект метаданных пагинации для ответа
 */
export function createPaginationMeta(
  page: number, 
  limit: number, 
  total: number
): {
  page: number
  limit: number
  total: number
  pages: number
  hasNext: boolean
  hasPrev: boolean
} {
  const pages = Math.ceil(total / limit)
  
  return {
    page,
    limit,
    total,
    pages,
    hasNext: page < pages,
    hasPrev: page > 1,
  }
}

/**
 * Валидирует что параметры пагинации находятся в допустимых пределах
 */
export function validatePaginationLimits(page: number, limit: number): {
  isValid: boolean
  error?: string
  correctedPage?: number
  correctedLimit?: number
} {
  let correctedPage = page
  let correctedLimit = limit
  let isValid = true
  let error: string | undefined

  // Проверяем page
  if (page < 1) {
    correctedPage = 1
    isValid = false
    error = 'Page must be greater than 0'
  }

  // Проверяем limit
  if (limit < 1) {
    correctedLimit = 20
    isValid = false
    error = error ? `${error}; Limit must be greater than 0` : 'Limit must be greater than 0'
  } else if (limit > 100) {
    correctedLimit = 100
    isValid = false
    error = error ? `${error}; Limit cannot exceed 100` : 'Limit cannot exceed 100'
  }

  return {
    isValid,
    error,
    correctedPage: isValid ? undefined : correctedPage,
    correctedLimit: isValid ? undefined : correctedLimit,
  }
}

/**
 * Создает объект для сортировки Prisma
 */
export function createPrismaOrderBy(
  sortBy?: string, 
  sortOrder: 'asc' | 'desc' = 'desc',
  allowedFields: string[] = ['createdAt', 'updatedAt']
): Record<string, 'asc' | 'desc'> | Record<string, 'asc' | 'desc'>[] {
  
  // Если sortBy не указан или не разрешен, используем createdAt
  if (!sortBy || !allowedFields.includes(sortBy)) {
    return { createdAt: sortOrder }
  }

  return { [sortBy]: sortOrder }
}

/**
 * Извлекает параметры поиска с валидацией
 */
export function extractSearchParams(
  request: NextRequest,
  allowedParams: string[] = []
): Record<string, string | string[] | undefined> {
  const { searchParams } = new URL(request.url)
  const params: Record<string, string | string[] | undefined> = {}

  for (const [key, value] of searchParams.entries()) {
    if (allowedParams.length === 0 || allowedParams.includes(key)) {
      // Если параметр уже существует, создаем массив
      if (params[key]) {
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value)
        } else {
          params[key] = [params[key] as string, value]
        }
      } else {
        params[key] = value
      }
    }
  }

  return params
}

/**
 * Нормализует булевые параметры из URL
 */
export function normalizeBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined || value === null) {
    return undefined
  }
  
  const normalized = value.toLowerCase().trim()
  
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true
  }
  
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }
  
  return undefined
}

/**
 * Нормализует массивы из URL параметров
 */
export function normalizeArray(value: string | string[] | undefined): string[] | undefined {
  if (!value) {
    return undefined
  }
  
  if (Array.isArray(value)) {
    return value.filter(v => v.trim().length > 0)
  }
  
  // Разделяем по запятой если это строка
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0)
}

/**
 * Создает стандартизированный ответ с пагинацией
 */
export function createPaginatedResponse<T>(
  data: T[],
  pagination: ReturnType<typeof createPaginationMeta>,
  message?: string
) {
  return {
    success: true,
    data,
    pagination,
    message,
  }
}
