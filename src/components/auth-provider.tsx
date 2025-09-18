"use client"

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@/lib/auth-client'
import { AuthClient } from '@/lib/auth-client'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (username: string, password: string) => Promise<{ user: User } | { error: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Вызываем refreshUser только после монтирования компонента
    if (mounted) {
      refreshUser()
    }
  }, [mounted])

  const refreshUser = async () => {
    try {
      console.log('🔄 Refreshing user data...')
      const currentUser = await AuthClient.getCurrentUser()
      console.log('✅ User data received:', currentUser)
      setUser(currentUser)
    } catch (error) {
      console.error('❌ Failed to refresh user:', error)
      setUser(null)
    } finally {
      // Гарантируем что loading будет установлен в false
      setLoading(false)
    }
  }

  const login = async (username: string, password: string) => {
    const result = await AuthClient.login(username, password)
    if ('user' in result) {
      setUser(result.user)
    }
    return result
  }

  const logout = async () => {
    await AuthClient.logout()
    setUser(null)
  }

  const value = {
    user,
    loading,
    login,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      <div suppressHydrationWarning>
        {children}
      </div>
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
