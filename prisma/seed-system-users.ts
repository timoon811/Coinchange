import { PrismaClient } from '@prisma/client'
import { AuthService } from '../src/lib/auth'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Создание системных пользователей...')

  // 1. Создаем системного пользователя для Telegram бота
  const telegramBotUser = await prisma.user.upsert({
    where: { username: 'telegram-bot' },
    update: {},
    create: {
      username: 'telegram-bot',
      firstName: 'Telegram',
      lastName: 'Bot',
      password: await AuthService.hashPassword('system-password-never-used'),
      role: 'ADMIN', // Системный пользователь с правами администратора
      isActive: true,
      officeIds: [], // Системный пользователь не привязан к офисам
    },
  })

  console.log('✅ Telegram Bot пользователь создан:', telegramBotUser.id)

  // 2. Создаем общего системного пользователя
  const systemUser = await prisma.user.upsert({
    where: { username: 'system' },
    update: {},
    create: {
      username: 'system',
      firstName: 'System',
      lastName: 'User',
      password: await AuthService.hashPassword('system-password-never-used'),
      role: 'ADMIN', // Системный пользователь с правами администратора
      isActive: true,
      officeIds: [], // Системный пользователь не привязан к офисам
    },
  })

  console.log('✅ System пользователь создан:', systemUser.id)

  // 3. Создаем пользователя для API операций
  const apiUser = await prisma.user.upsert({
    where: { username: 'api-system' },
    update: {},
    create: {
      username: 'api-system',
      firstName: 'API',
      lastName: 'System',
      password: await AuthService.hashPassword('system-password-never-used'),
      role: 'ADMIN',
      isActive: true,
      officeIds: [],
    },
  })

  console.log('✅ API System пользователь создан:', apiUser.id)

  console.log('🎉 Все системные пользователи созданы успешно!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при создании системных пользователей:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
