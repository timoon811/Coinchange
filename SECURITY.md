# 🔒 Безопасность CryptoCoinChange

## Обзор

Этот документ содержит инструкции по настройке безопасности для проекта CryptoCoinChange.

## ⚠️ Критически важные настройки

### 1. Переменные окружения

**Никогда не используйте значения по умолчанию в продакшене!**

```bash
# Генерация безопасных ключей
npm run generate-keys

# Или вручную:
openssl rand -base64 32  # для JWT_SECRET
openssl rand -hex 32     # для ENCRYPTION_KEY
```

### 2. Обязательные переменные окружения

Создайте файл `.env` в корне проекта:

```env
# База данных
DATABASE_URL="postgresql://user:password@host:5432/db"

# JWT (минимум 32 символа)
JWT_SECRET="your_super_secure_jwt_secret_here"
JWT_EXPIRE="7d"

# Шифрование (ровно 64 hex символа)
ENCRYPTION_KEY="your_64_char_hex_key_here"

# Telegram бот
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"

# NextAuth
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="https://yourdomain.com"

# PostgreSQL
POSTGRES_PASSWORD="your_strong_password"
```

### 3. Настройка базы данных

```sql
-- Создание пользователя с ограниченными правами
CREATE USER crypto_app WITH PASSWORD 'your_strong_password';
GRANT CONNECT ON DATABASE crypto_exchange_db TO crypto_app;
GRANT USAGE ON SCHEMA public TO crypto_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO crypto_app;
```

### 4. HTTPS и SSL

```nginx
# Пример конфигурации Nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Безопасные настройки SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🛡️ Меры безопасности

### Rate Limiting

```typescript
// middleware.ts
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100, // лимит 100 запросов с IP
  message: 'Слишком много запросов с этого IP'
})
```

### CORS политика

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGINS || 'https://yourdomain.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type,Authorization' },
        ],
      },
    ]
  },
}
```

### Content Security Policy

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
          },
        ],
      },
    ]
  },
}
```

## 🔍 Мониторинг безопасности

### Логирование

```typescript
// lib/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'security.log', level: 'warn' }),
    new winston.transports.Console()
  ],
})
```

### Мониторинг неудачных попыток входа

```typescript
// middleware/auth.ts
let failedAttempts = new Map()

export function trackFailedLogin(ip: string) {
  const attempts = failedAttempts.get(ip) || 0
  failedAttempts.set(ip, attempts + 1)

  if (attempts >= 5) {
    // Блокировка IP или уведомление админа
    logger.warn(`Suspicious activity from IP: ${ip}`)
  }
}
```

## 🚨 Инциденты безопасности

### Что делать при компрометации:

1. **Немедленно смените все ключи:**
   ```bash
   npm run generate-keys
   ```

2. **Проверьте логи на подозрительную активность:**
   ```bash
   grep "WARN\|ERROR" logs/*.log
   ```

3. **Уведомите пользователей** о возможной компрометации

4. **Проведите аудит** всех изменений в коде

5. **Обновите зависимости** на последние версии

## 📋 Чек-лист безопасности

### Перед запуском в продакшен:
- [ ] JWT_SECRET минимум 32 символа
- [ ] ENCRYPTION_KEY ровно 64 hex символа
- [ ] Сложный пароль базы данных
- [ ] HTTPS включен
- [ ] CORS настроен правильно
- [ ] Rate limiting включен
- [ ] CSP заголовки установлены
- [ ] Логирование настроено
- [ ] Регулярные обновления зависимостей
- [ ] Мониторинг включен

### Ежемесячные проверки:
- [ ] Проверка логов на подозрительную активность
- [ ] Обновление зависимостей
- [ ] Проверка конфигурации безопасности
- [ ] Аудит пользовательских ролей

### При изменениях:
- [ ] Ревью кода на безопасность
- [ ] Тестирование на уязвимости
- [ ] Обновление документации
