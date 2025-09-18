import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient, UserRole } from '@prisma/client'

const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Проверяем авторизацию
    const { authorization } = Object.fromEntries(request.headers.entries())
    if (authorization !== 'Bearer setup-permissions-token') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🔧 Настройка прав доступа...')

    // Получаем все права
    const allPermissions = await prisma.permission.findMany()
    console.log(`📋 Найдено ${allPermissions.length} прав`)

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

    // Удаляем существующие связи
    await prisma.rolePermission.deleteMany()

    // Назначаем все права администратору
    const adminRolePermissions = await Promise.all(
      allPermissions.map(permission =>
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

    // Назначаем ограниченные права кассиру
    const cashierRolePermissions = await Promise.all(
      allPermissions
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

    return NextResponse.json({
      success: true,
      message: 'Права доступа настроены!',
      stats: {
        totalPermissions: allPermissions.length,
        adminPermissions: adminRolePermissions.length,
        cashierPermissions: cashierRolePermissions.length
      }
    })

  } catch (error) {
    console.error('❌ Ошибка при настройке прав:', error)
    return NextResponse.json(
      { 
        error: 'Ошибка при настройке прав доступа',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
