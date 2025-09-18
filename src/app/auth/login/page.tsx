import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AuthService } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import LoginForm from './login-form'

export default async function LoginPage() {
  // Проверяем, авторизован ли уже пользователь
  const cookieStore = await cookies()
  const token = cookieStore.get('auth-token')?.value

  if (token) {
    const payload = AuthService.verifyToken(token)

    if (payload) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, isActive: true },
      })

      if (user && user.isActive) {
        redirect('/dashboard')
      }
    }
  }

  return <LoginForm />
}
