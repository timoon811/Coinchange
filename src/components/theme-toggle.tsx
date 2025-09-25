"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useIsMounted } from "@/hooks/use-is-mounted"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const isMounted = useIsMounted()

  // Предотвращаем мерцание до монтирования
  if (!isMounted) {
    return (
      <Button variant="ghost" size="sm" className="w-9 h-9">
        <div className="h-[1.2rem] w-[1.2rem]" />
        <span className="sr-only">Переключить тему</span>
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="relative w-9 h-9 stable-layout"
    >
      <Sun 
        className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 dark:-rotate-90 dark:scale-0"
        style={{
          transition: 'transform 200ms ease, opacity 200ms ease'
        }}
      />
      <Moon 
        className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 dark:rotate-0 dark:scale-100"
        style={{
          transition: 'transform 200ms ease, opacity 200ms ease'
        }}
      />
      <span className="sr-only">Переключить тему</span>
    </Button>
  )
}
