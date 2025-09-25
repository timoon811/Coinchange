"use client"

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Loader2 } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: 'ADMIN' | 'CASHIER'
  allowedOffices?: string[]
}

export function AuthGuard({ children, requiredRole, allowedOffices }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    if (!loading && !user) {
      router.push('/auth/login')
      return
    }

    if (!loading && user) {
      // Проверка роли
      if (requiredRole && user.role !== requiredRole) {
        router.push('/dashboard')
        return
      }

      // Проверка офисов для кассиров
      if (user.role === 'CASHIER' && allowedOffices && allowedOffices.length > 0) {
        const hasAccess = user.officeIds.some(officeId => allowedOffices.includes(officeId))
        if (!hasAccess) {
          router.push('/dashboard')
          return
        }
      }
    }
  }, [user, loading, requiredRole, allowedOffices, router, mounted])

  // Показываем загрузку пока проверяем авторизацию или компонент не смонтирован
  if (loading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen stable-layout">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Проверка авторизации...</p>
        </div>
      </div>
    )
  }

  // Показываем загрузку пока перенаправляем
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen stable-layout">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Перенаправление...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
