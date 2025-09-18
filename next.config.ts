import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Оптимизация производительности
  experimental: {
    // Включаем оптимизацию CSS для production
    optimizeCss: true,
  },

  // Настройки для предотвращения проблем с гидратацией
  generateBuildId: async () => {
    // Используем более стабильный ID для лучшего кеширования
    return 'build-' + Math.random().toString(36).substring(2, 15)
  },

  // Настройки TypeScript
  typescript: {
    // Показывать ошибки TypeScript во время сборки
    ignoreBuildErrors: false,
  },

  // Настройки ESLint
  eslint: {
    // Показывать ошибки ESLint во время сборки
    ignoreDuringBuilds: false,
  },

  // Настройки изображений (если используются)
  images: {
    domains: ['localhost'],
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Настройки заголовков безопасности
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type,Authorization,X-Requested-With',
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self'",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default nextConfig;
