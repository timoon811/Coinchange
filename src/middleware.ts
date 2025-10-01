import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { AuthService } from '@/lib/auth'
import { RateLimit } from '@/lib/rate-limit'
import { ApiLogger } from '@/lib/api-logger'

// Публичные маршруты
const publicRoutes = [
  '/api/auth/login',
  '/api/auth/logout',
  '/api/telegram/webhook',
  '/api/health',
  '/api/client/auth',
  '/api/currencies',
  '/api/exchange-rates',
  '/api/requests',
]

// Маршруты, требующие аутентификации
const protectedRoutes = [
  '/dashboard',
  '/dashboard/requests',
  '/dashboard/clients',
  '/dashboard/reports',
  '/dashboard/settings',
  '/dashboard/sla',
  '/admin',
]

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutes.some(route => pathname.startsWith(route))
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = Date.now()

  // Логируем API запросы
  let requestLogData
  if (pathname.startsWith('/api/')) {
    requestLogData = ApiLogger.logRequest(request)
  }

  // Пропускаем статические файлы
  if (
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Обработка CORS preflight запросов
  if (pathname.startsWith('/api/') && request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'http://localhost:3001',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Rate limiting для API маршрутов
  if (pathname.startsWith('/api/')) {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') ||
                     request.headers.get('x-client-ip') ||
                     'unknown'

    const rateLimitResult = RateLimit.check(request)

    if (!rateLimitResult.allowed) {
      return RateLimit.createResponse(rateLimitResult)
    }

    // Добавляем заголовки rate limiting в ответ
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetTime.toString())

    // Логируем API ответ
    if (requestLogData) {
      ApiLogger.logResponse(requestLogData, response, startTime)
    }

    return response
  }

  // Пропускаем страницы аутентификации - они обрабатываются на клиенте
  if (pathname.startsWith('/auth/')) {
    return NextResponse.next()
  }

  // Проверяем защищенные маршруты только если есть токен
  if (isProtectedRoute(pathname)) {
    const token = request.cookies.get('auth-token')?.value

    if (!token) {
      // Не перенаправляем здесь - пусть клиент сам обработает
      return NextResponse.next()
    }

    // Проверяем валидность токена
    const payload = AuthService.verifyToken(token)
    if (!payload) {
      // Не перенаправляем здесь - пусть клиент сам обработает
      return NextResponse.next()
    }

    console.log('Token valid, proceeding with user:', payload.userId)

    // Добавляем информацию о пользователе в заголовки
    const response = NextResponse.next()
    response.headers.set('x-user-id', payload.userId)
    response.headers.set('x-user-role', payload.role)
    response.headers.set('x-user-offices', JSON.stringify(payload.officeIds || []))

    // Логируем API ответ для защищенных маршрутов
    if (requestLogData && pathname.startsWith('/api/')) {
      ApiLogger.logResponse(requestLogData, response, startTime)
    }

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
}
