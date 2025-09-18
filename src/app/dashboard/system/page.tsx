"use client"

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SystemPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/dashboard/settings?tab=system')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Перенаправление...</p>
      </div>
    </div>
  )
}
