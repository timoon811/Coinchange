import { PrismaClient, UserRole, PermissionType, ResourceType } from '@prisma/client'

const prisma = new PrismaClient()

interface PermissionSeed {
  name: string
  description: string
  type: PermissionType
  resource: ResourceType
  conditions?: any
}

const basePermissions: PermissionSeed[] = [
  // Доступ к страницам
  {
    name: 'Доступ к главной странице',
    description: 'Просмотр дашборда и основной статистики',
    type: 'PAGE_ACCESS',
    resource: 'DASHBOARD'
  },
  {
    name: 'Доступ к заявкам',
    description: 'Просмотр списка заявок',
    type: 'PAGE_ACCESS',
    resource: 'REQUESTS'
  },
  {
    name: 'Доступ к клиентам',
    description: 'Просмотр списка клиентов',
    type: 'PAGE_ACCESS',
    resource: 'CLIENTS'
  },
  {
    name: 'Доступ к бухгалтерии',
    description: 'Доступ к разделу бухгалтерского учета',
    type: 'PAGE_ACCESS',
    resource: 'ACCOUNTING'
  },
  {
    name: 'Доступ к аналитике',
    description: 'Просмотр аналитических данных',
    type: 'PAGE_ACCESS',
    resource: 'ANALYTICS'
  },
  {
    name: 'Доступ к отчетам',
    description: 'Просмотр отчетов',
    type: 'PAGE_ACCESS',
    resource: 'REPORTS'
  },
  {
    name: 'Доступ к настройкам',
    description: 'Доступ к админ панели',
    type: 'PAGE_ACCESS',
    resource: 'SETTINGS'
  },
  {
    name: 'Доступ к SLA',
    description: 'Просмотр и управление SLA',
    type: 'PAGE_ACCESS',
    resource: 'SLA'
  },

  // Подстраницы бухгалтерии
  {
    name: 'Управление счетами',
    description: 'Просмотр и редактирование счетов офисов',
    type: 'PAGE_ACCESS',
    resource: 'ACCOUNTS'
  },
  {
    name: 'Управление валютами',
    description: 'Настройка валют в системе',
    type: 'PAGE_ACCESS',
    resource: 'CURRENCIES'
  },
  {
    name: 'Управление депозитами',
    description: 'Работа с депозитами',
    type: 'PAGE_ACCESS',
    resource: 'DEPOSITS'
  },
  {
    name: 'Управление курсами валют',
    description: 'Установка и изменение курсов обмена',
    type: 'PAGE_ACCESS',
    resource: 'EXCHANGE_RATES'
  },
  {
    name: 'Управление операциями',
    description: 'Создание и просмотр финансовых операций',
    type: 'PAGE_ACCESS',
    resource: 'OPERATIONS'
  },

  // Действия с заявками
  {
    name: 'Создание заявки',
    description: 'Возможность создавать новые заявки',
    type: 'ACTION',
    resource: 'CREATE_REQUEST'
  },
  {
    name: 'Редактирование заявки',
    description: 'Изменение существующих заявок',
    type: 'ACTION',
    resource: 'EDIT_REQUEST'
  },
  {
    name: 'Удаление заявки',
    description: 'Удаление заявок из системы',
    type: 'ACTION',
    resource: 'DELETE_REQUEST'
  },
  {
    name: 'Назначение заявки',
    description: 'Назначение заявок на кассиров',
    type: 'ACTION',
    resource: 'ASSIGN_REQUEST'
  },

  // Действия с клиентами
  {
    name: 'Создание клиента',
    description: 'Добавление новых клиентов',
    type: 'ACTION',
    resource: 'CREATE_CLIENT'
  },
  {
    name: 'Редактирование клиента',
    description: 'Изменение данных клиентов',
    type: 'ACTION',
    resource: 'EDIT_CLIENT'
  },
  {
    name: 'Удаление клиента',
    description: 'Удаление клиентов из системы',
    type: 'ACTION',
    resource: 'DELETE_CLIENT'
  },

  // Действия с операциями
  {
    name: 'Создание операции',
    description: 'Создание финансовых операций',
    type: 'ACTION',
    resource: 'CREATE_OPERATION'
  },
  {
    name: 'Редактирование операции',
    description: 'Изменение финансовых операций',
    type: 'ACTION',
    resource: 'EDIT_OPERATION'
  },
  {
    name: 'Удаление операции',
    description: 'Удаление финансовых операций',
    type: 'ACTION',
    resource: 'DELETE_OPERATION'
  },

  // Административные действия
  {
    name: 'Создание пользователя',
    description: 'Добавление новых пользователей системы',
    type: 'ACTION',
    resource: 'CREATE_USER'
  },
  {
    name: 'Редактирование пользователя',
    description: 'Изменение данных пользователей',
    type: 'ACTION',
    resource: 'EDIT_USER'
  },
  {
    name: 'Удаление пользователя',
    description: 'Удаление пользователей из системы',
    type: 'ACTION',
    resource: 'DELETE_USER'
  },
  {
    name: 'Управление курсами',
    description: 'Установка и изменение валютных курсов',
    type: 'ACTION',
    resource: 'MANAGE_RATES'
  },
  {
    name: 'Управление счетами',
    description: 'Создание и управление счетами офисов',
    type: 'ACTION',
    resource: 'MANAGE_ACCOUNTS'
  },
  {
    name: 'Управление офисами',
    description: 'Создание и настройка офисов',
    type: 'ACTION',
    resource: 'MANAGE_OFFICES'
  },

  // Отчеты
  {
    name: 'Просмотр отчетов',
    description: 'Доступ к просмотру отчетов',
    type: 'ACTION',
    resource: 'VIEW_REPORTS'
  },
  {
    name: 'Экспорт отчетов',
    description: 'Возможность экспортировать отчеты',
    type: 'ACTION',
    resource: 'EXPORT_REPORTS'
  },

  // Системные права
  {
    name: 'Системные настройки',
    description: 'Доступ к системным настройкам',
    type: 'ACTION',
    resource: 'SYSTEM_SETTINGS'
  },
  {
    name: 'Настройка комиссий',
    description: 'Управление правилами комиссий',
    type: 'ACTION',
    resource: 'COMMISSION_RULES'
  },

  // Функционал
  {
    name: 'Массовые операции',
    description: 'Выполнение массовых операций',
    type: 'FEATURE',
    resource: 'BULK_OPERATIONS'
  },
  {
    name: 'Расширенный поиск',
    description: 'Доступ к расширенным возможностям поиска',
    type: 'FEATURE',
    resource: 'ADVANCED_SEARCH'
  },
  {
    name: 'Логи аудита',
    description: 'Просмотр логов аудита системы',
    type: 'FEATURE',
    resource: 'AUDIT_LOGS'
  }
]

// Права для администратора (все права)
const adminPermissions = basePermissions.map(p => p.name)

// Права для кассира (ограниченные)
const cashierPermissions = [
  'Доступ к главной странице',
  'Доступ к заявкам',
  'Доступ к клиентам',
  'Доступ к бухгалтерии',
  'Управление счетами',
  'Управление депозитами',
  'Управление курсами валют',
  'Управление операциями',
  'Создание заявки',
  'Редактирование заявки',
  'Назначение заявки',
  'Создание клиента',
  'Редактирование клиента',
  'Создание операции',
  'Редактирование операции',
  'Управление курсами',
  'Просмотр отчетов'
]

async function seedPermissions() {
  console.log('🌱 Заполнение базовых прав доступа...')

  try {
    // Удаляем существующие права и роли
    console.log('🗑️  Очистка существующих данных...')
    await prisma.rolePermission.deleteMany()
    await prisma.permission.deleteMany()

    // Создаем базовые права
    console.log('✨ Создание базовых прав...')
    const createdPermissions = await Promise.all(
      basePermissions.map(permission =>
        prisma.permission.create({
          data: permission
        })
      )
    )

    console.log(`✅ Создано ${createdPermissions.length} прав`)

    // Создаем связи для администратора
    console.log('👑 Назначение прав администратору...')
    const adminRolePermissions = await Promise.all(
      createdPermissions
        .filter(p => adminPermissions.includes(p.name))
        .map(permission =>
          prisma.rolePermission.create({
            data: {
              role: UserRole.ADMIN,
              permissionId: permission.id,
              isActive: true
            }
          })
        )
    )

    console.log(`✅ Назначено ${adminRolePermissions.length} прав администратору`)

    // Создаем связи для кассира
    console.log('💼 Назначение прав кассиру...')
    const cashierRolePermissions = await Promise.all(
      createdPermissions
        .filter(p => cashierPermissions.includes(p.name))
        .map(permission =>
          prisma.rolePermission.create({
            data: {
              role: UserRole.CASHIER,
              permissionId: permission.id,
              isActive: true
            }
          })
        )
    )

    console.log(`✅ Назначено ${cashierRolePermissions.length} прав кассиру`)

    console.log('🎉 Заполнение прав доступа завершено!')

  } catch (error) {
    console.error('❌ Ошибка при заполнении прав:', error)
    throw error
  }
}

async function main() {
  await seedPermissions()
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}

export { seedPermissions }
