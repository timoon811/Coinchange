import { useState, useCallback } from 'react'
import { toast } from 'sonner'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

interface ApiOptions extends RequestInit {
  showSuccessToast?: boolean
  showErrorToast?: boolean
  successMessage?: string
}

export function useApi<T>() {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const execute = useCallback(async (
    url: string,
    options?: ApiOptions
  ): Promise<T | null> => {
    const { showSuccessToast = false, showErrorToast = true, successMessage, ...fetchOptions } = options || {}
    
    setState({ data: null, loading: true, error: null })

    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions?.headers,
        },
        credentials: 'include', // Важно для отправки cookies с токеном аутентификации
        ...fetchOptions,
      })

      const result = await response.json()

      if (!response.ok) {
        const errorMessage = result.error || result.message || 'API request failed'
        throw new Error(errorMessage)
      }

      // Поддержка разных форматов ответа API
      const data = result.success !== undefined ? result.data || result : result
      
      setState({ data, loading: false, error: null })
      
      // Показываем успешное уведомление если нужно
      if (showSuccessToast) {
        toast.success(successMessage || result.message || 'Операция выполнена успешно')
      }
      
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState({ data: null, loading: false, error: errorMessage })
      
      // Показываем ошибку если нужно
      if (showErrorToast) {
        toast.error(errorMessage)
      }
      
      return null
    }
  }, [])

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    ...state,
    execute,
    reset,
  }
}
