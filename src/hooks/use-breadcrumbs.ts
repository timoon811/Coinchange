'use client'

import { usePathname } from 'next/navigation'
import { useMemo } from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

const routeMap: Record<string, string> = {
  dashboard: 'Дашборд',
  requests: 'Заявки',
  clients: 'Клиенты',
  profile: 'Профиль',
  sla: 'SLA Мониторинг',
  analytics: 'Аналитика',
  reports: 'Отчеты',
  settings: 'Настройки',
  system: 'Система',
  users: 'Пользователи',
  offices: 'Офисы',
  accounting: 'Учет',
  currencies: 'Валюты',
  accounts: 'Счета офисов',
  'exchange-rates': 'Курсы валют',
  operations: 'Операции',
  deposits: 'Депозиты',
  new: 'Создание',
  comments: 'Комментарии',
  edit: 'Редактирование',
}

const sectionMap: Record<string, string> = {
  '/dashboard': 'Главная',
  '/dashboard/requests': 'Управление',
  '/dashboard/clients': 'Управление',
  '/dashboard/profile': 'Аккаунт',
  '/dashboard/sla': 'Управление',
  '/dashboard/analytics': 'Отчеты',
  '/dashboard/reports': 'Отчеты',
  '/dashboard/settings': 'Администрирование',
  '/dashboard/system': 'Администрирование',
  '/dashboard/users': 'Администрирование',
  '/dashboard/offices': 'Администрирование',
  '/dashboard/accounting': 'Учет',
  '/dashboard/accounting/currencies': 'Учет',
  '/dashboard/accounting/accounts': 'Учет',
  '/dashboard/accounting/exchange-rates': 'Учет',
  '/dashboard/accounting/operations': 'Учет',
  '/dashboard/accounting/deposits': 'Учет',
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname()

  return useMemo(() => {
    const segments = pathname.split('/').filter(Boolean)
    const breadcrumbs: BreadcrumbItem[] = []

    // Всегда добавляем CryptoCRM как корень
    breadcrumbs.push({
      label: 'CryptoCRM',
      href: '/dashboard',
    })

    if (segments.length === 1 && segments[0] === 'dashboard') {
      // Если мы на главной странице дашборда
      breadcrumbs.push({
        label: 'Главная',
        isActive: true,
      })
      return breadcrumbs
    }

    let currentPath = ''
    let sectionAdded = false

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      currentPath += `/${segment}`

      // Пропускаем 'dashboard' - он уже обработан как корень
      if (segment === 'dashboard') continue

      // Определяем метку для текущего сегмента
      let label = routeMap[segment] || segment
      
      // Определяем, нужно ли добавить секцию
      if (!sectionAdded) {
        const sectionName = sectionMap[currentPath]
        if (sectionName && sectionName !== 'Главная' && sectionName !== label) {
          // Проверяем, что секция еще не была добавлена с таким же названием
          const alreadyExists = breadcrumbs.some(b => b.label === sectionName)
          if (!alreadyExists) {
            breadcrumbs.push({
              label: sectionName,
            })
            sectionAdded = true
          }
        }
      }

      // Обработка динамических ID сегментов
      if (segment.match(/^[a-f0-9-]{36}$/) || segment.match(/^\d+$/) || segment.startsWith('tg-')) {
        // Это ID, заменяем на понятное название
        if (i > 0) {
          const prevSegment = segments[i - 1]
          if (prevSegment === 'requests') {
            label = `Просмотр заявки`
          } else if (prevSegment === 'clients') {
            label = `Профиль клиента`
          } else if (prevSegment === 'users') {
            label = `Профиль пользователя`
          } else if (prevSegment === 'offices') {
            label = `Информация об офисе`
          } else {
            label = `Детали`
          }
        }
      }

      // Добавляем хлебную крошку
      const isLast = i === segments.length - 1
      breadcrumbs.push({
        label,
        href: isLast ? undefined : currentPath,
        isActive: isLast,
      })
    }

    return breadcrumbs
  }, [pathname])
}
