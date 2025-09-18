import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AuthService } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function Home() {
  try {
    // Получаем токен из cookies
    const cookieStore = await cookies()
    const token = cookieStore.get('auth-token')?.value

    if (token) {
      try {
        // Проверяем валидность токена
        const payload = await AuthService.verifyToken(token)

        if (payload) {
          // Проверяем, что пользователь существует и активен
          const user = await prisma.user.findUnique({
            where: { id: payload.userId },
            select: { id: true, isActive: true },
          })

          if (user && user.isActive) {
            // Перенаправляем на дашборд
            redirect('/dashboard')
          }
        }
      } catch (error) {
        console.error('Token verification failed:', error)
        // Продолжаем к редиректу на логин
      }
    }

    // Перенаправляем на страницу логина
    redirect('/auth/login')
  } catch (error) {
    // NEXT_REDIRECT это не ошибка, а стандартное поведение Next.js
    if (error instanceof Error && (error.message === 'NEXT_REDIRECT' || error.message.startsWith('NEXT_REDIRECT'))) {
      throw error // Пробрасываем редирект дальше
    }
    console.error('Home page error:', error)
    // В случае ошибки всё равно перенаправляем на логин
    redirect('/auth/login')
  }
}
