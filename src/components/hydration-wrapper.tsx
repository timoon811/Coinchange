"use client"

import { ReactNode } from 'react'

interface HydrationWrapperProps {
  children: ReactNode
  className?: string
}

export function HydrationWrapper({ children, className }: HydrationWrapperProps) {
  return (
    <div className={className} suppressHydrationWarning>
      {children}
    </div>
  )
}

