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
    <Sidebar suppressHydrationWarning>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">CryptoCRM</span>
            <span className="text-xs text-muted-foreground">Обменный сервис</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {navigation.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 h-auto p-2">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">
                    {user ? getInitials(user.firstName, user.lastName) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium">
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
                <Link href="/dashboard/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Профиль</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Настройки</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
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
