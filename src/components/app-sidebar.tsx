"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  BarChart3,
  Users,
  FileText,
  Settings,
  Home,
  Bell,
  LogOut,
  User,
  AlertTriangle,
  DollarSign,
  Wallet,
  TrendingUp,
  Calculator,
  PiggyBank,
} from "lucide-react"

// Псевдоним для Settings иконки
const SettingsIcon = Settings

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Link from "next/link"

const navigation = [
  {
    title: "Главная",
    items: [
      {
        title: "Дашборд",
        url: "/dashboard",
        icon: Home,
      },
    ],
  },
  {
    title: "Управление",
    items: [
      {
        title: "Заявки",
        url: "/dashboard/requests",
        icon: FileText,
      },
      {
        title: "Клиенты",
        url: "/dashboard/clients",
        icon: Users,
      },
      {
        title: "SLA Мониторинг",
        url: "/dashboard/sla",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Учет",
    items: [
      {
        title: "Валюты",
        url: "/dashboard/accounting/currencies",
        icon: DollarSign,
      },
      {
        title: "Счета офисов",
        url: "/dashboard/accounting/accounts",
        icon: Wallet,
      },
      {
        title: "Курсы валют",
        url: "/dashboard/accounting/exchange-rates",
        icon: TrendingUp,
      },
      {
        title: "Операции",
        url: "/dashboard/accounting/operations",
        icon: Calculator,
      },
      {
        title: "Депозиты",
        url: "/dashboard/accounting/deposits",
        icon: PiggyBank,
      },
    ],
  },
  {
    title: "Отчеты",
    items: [
      {
        title: "Аналитика",
        url: "/dashboard/analytics",
        icon: BarChart3,
      },
      {
        title: "Отчеты",
        url: "/dashboard/reports",
        icon: FileText,
      },
    ],
  },
  {
    title: "Администрирование",
    items: [
      {
        title: "Админ панель",
        url: "/dashboard/settings",
        icon: SettingsIcon,
      },
    ],
  },
]

export function AppSidebar() {
  const { user, logout } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.push('/auth/login')
  }

  const getInitials = (firstName?: string | null, lastName?: string | null) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || 'U'
  }

  return (
    <Sidebar suppressHydrationWarning className="stable-layout">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary text-primary-foreground shadow-lg">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold">CryptoCRM</span>
            <span className="text-sm text-muted-foreground">Обменный сервис</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4">
        {navigation.map((group) => (
          <SidebarGroup key={group.title} className="mb-6">
            <SidebarGroupLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {group.title}
            </SidebarGroupLabel>
            <SidebarMenu className="space-y-1">
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="group">
                    <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-accent hover:text-accent-foreground smooth-hover">
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-3 h-auto p-3 w-full justify-start hover:bg-accent smooth-hover">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-sm font-semibold">
                    {user ? getInitials(user.firstName, user.lastName) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-semibold">
                    {user ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Пользователь'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {user?.role === 'ADMIN' ? 'Администратор' : 'Кассир'}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/profile" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>Профиль</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Настройки</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
