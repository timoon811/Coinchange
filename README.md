# Crypto Exchange CRM

Внутренняя CRM система для обменного сервиса криптовалют с интеграцией Telegram бота.

## ✨ Новые возможности

### 🔒 Улучшенная безопасность
- **Rate Limiting**: Защита от DDoS атак с настраиваемыми лимитами
- **Content Security Policy**: Защита от XSS атак
- **CORS политика**: Контроль междоменных запросов
- **Расширенное логирование**: Детальное логирование безопасности и аудита
- **Валидация данных**: Zod схемы для всех входных данных

### ⚡ Производительность
- **Кеширование**: In-memory кеш для часто запрашиваемых данных
- **Оптимизация API**: Улучшенные запросы к базе данных
- **Health Check**: Расширенный мониторинг здоровья системы

### 🧪 Тестирование
- **Интеграционные тесты**: Playwright для end-to-end тестирования
- **Улучшенные unit тесты**: Исправлены все существующие тесты
- **Автоматизированное тестирование**: CI/CD готовые скрипты

## 🚀 Быстрый запуск

### Автоматический запуск (рекомендуется)

```bash
# Быстрый запуск со всеми зависимостями
./start.sh
```

Этот скрипт автоматически:
- Запустит PostgreSQL базу данных через Docker
- Установит зависимости
- Настроит базу данных
- Заполнит демо-данными
- Запустит сервер разработки

### Ручная настройка

#### 1. Установка зависимостей

```bash
npm install
```

#### 2. Настройка переменных окружения

Скопируйте `.env.example` в `.env.local` и настройте переменные:

```bash
cp .env.example .env.local
```

#### 3. Запуск базы данных

```bash
# Через Docker Compose (рекомендуется)
docker-compose up -d postgres

# Или установите PostgreSQL локально
```

#### 4. Настройка базы данных

```bash
# Генерация Prisma клиента
npm run db:generate

# Создание и применение миграций
npm run db:push

# Заполнение демо-данными
npm run db:seed
```

#### 5. Запуск приложения

```bash
npm run dev
```

Приложение будет доступно по адресу: http://localhost:3000

## 🐛 Исправленные ошибки

В рамках аудита проекта были исправлены следующие проблемы:

### ✅ Решенные проблемы

1. **Ошибка гидратации React** - исправлена проблема несоответствия между серверным и клиентским рендером
2. **Отсутствующие переменные окружения** - созданы `.env.local` и `.env.example` файлы
3. **Проблемы с TypeScript** - исправлены типы параметров в API маршрутах для Next.js 15
4. **Линтинг ошибки** - исправлены основные проблемы с типами и неиспользуемыми переменными
5. **Проблемы аутентификации** - исправлена обработка JWT токенов

### 🔧 Улучшения производительности

- Оптимизирована конфигурация Next.js
- Добавлены заголовки безопасности
- Настроена оптимизация изображений
- Улучшена обработка ошибок

## 📋 Учетные данные для демонстрации

После выполнения `npm run db:seed` будут созданы следующие пользователи:

- **Администратор**: `admin` / `admin123`
- **Кассир 1**: `cashier1` / `cashier123`
- **Кассир 2**: `cashier2` / `cashier123`

## 🏗️ Архитектура

### Основные сущности

- **Users** - пользователи системы (админы и кассиры)
- **Offices** - офисы/локации
- **Clients** - клиенты из Telegram
- **Requests** - заявки на обмен
- **RequestFinance** - финансовая информация заявок
- **Requisites** - реквизиты (кошельки, карты)
- **Attachments** - вложения (чеки, скриншоты)
- **Comments** - комментарии к заявкам
- **AuditLogs** - логи аудита
- **Notifications** - уведомления

### Статусы заявок

```
NEW → ASSIGNED → AWAITING_CLIENT → IN_PROGRESS → AWAITING_CONFIRMATION → COMPLETED
                                                                                   ↓
                                                                       CANCELED / REJECTED
```

### Роли пользователей

- **ADMIN**: полный доступ ко всем функциям
- **CASHIER**: доступ только к своим офисам и заявкам

## 🔧 API эндпоинты

### Аутентификация
- `POST /api/auth/login` - вход в систему
- `POST /api/auth/logout` - выход из системы
- `GET /api/auth/me` - получение текущего пользователя

### Заявки
- `GET /api/requests` - список заявок с фильтрами
- `GET /api/requests/:id` - получение заявки
- `PATCH /api/requests/:id` - обновление заявки
- `POST /api/requests/:id/assign` - назначение кассира/офиса

### Telegram интеграция
- `POST /api/telegram/webhook` - прием обновлений от бота

## 🧪 Тестирование

### Unit тесты
```bash
# Запуск unit тестов
npm test

# Запуск тестов с UI
npm run test:ui

# Запуск тестов с покрытием
npm run test:coverage
```

### Интеграционные тесты (E2E)
```bash
# Запуск интеграционных тестов
npm run test:integration

# Запуск с UI для отладки
npm run test:integration:ui

# Запуск в браузере (headed mode)
npm run test:integration:headed
```

### Новые тесты
- **Request Flow Tests**: Полный цикл работы с заявками
- **Authentication Flow Tests**: Тестирование входа/выхода
- **Rate Limiting Tests**: Проверка защиты от перегрузки
- **Security Tests**: Тестирование мер безопасности
- **API Validation Tests**: Тестирование валидации данных

### Настройка тестового окружения
```typescript
// Автоматическая настройка тестового пользователя
const authenticatedUser = await prisma.user.create({
  data: { /* тестовые данные */ }
})

// Автоматическая настройка тестового офиса
const testOffice = await prisma.office.create({
  data: { /* тестовые данные */ }
})
```

## 🗃️ Работа с базой данных

```bash
# Просмотр данных в браузере
npm run db:studio

# Создание новой миграции
npm run db:migrate

# Сброс базы данных
npm run db:reset
```

## 🔒 Безопасность

### Основные меры безопасности
- JWT токены для аутентификации
- Шифрование чувствительных данных (кошельки, карты)
- RBAC (Role-Based Access Control)
- Аудит всех действий пользователей
- Валидация всех входящих данных с помощью Zod

### Новые функции безопасности

#### Rate Limiting
```typescript
// Автоматическая защита от DDoS
// Настраиваемые лимиты по endpoint'ам:
// - /api/auth/login: 5 попыток за 15 минут
// - /api/dashboard: 30 запросов за минуту
// - /api/requests: 60 запросов за минуту
```

#### Content Security Policy
```typescript
// Защита от XSS атак
headers: {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
}
```

#### Расширенное логирование
```typescript
// Детальное логирование всех действий
logger.security('FAILED_LOGIN_ATTEMPT', {
  username,
  reason: 'invalid_password',
  ip: clientIP,
  userAgent
})

logger.audit(userId, 'LOGIN_SUCCESS', 'user', userId, {
  role: user.role,
  ip: clientIP
})
```

#### CORS политика
```typescript
// Контроль междоменных запросов
headers: {
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS,
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
}
```

### Health Check API
```http
GET /api/health
```
Возвращает метрики системы, статус базы данных, использование памяти и кеша.

## 📱 Интеграция с Telegram

Система принимает вебхуки от Telegram бота в формате:

```json
{
  "request_id": "tg-<timestamp>-<rand>",
  "client": {
    "telegram_user_id": 123456,
    "username": "user",
    "first_name": "Name"
  },
  "operation": {
    "direction": "CryptoToCash",
    "from_currency": "USDT",
    "from_network": "TRON",
    "to_currency": "TRY",
    "expected_amount_from": 1000
  },
  "requisites": {
    "wallet_address": "TTxxxx",
    "office_id": "office-001"
  }
}
```

## 🎨 Темизация

Приложение поддерживает темную и светлую тему. Переключатель темы доступен в боковой панели навигации.

## 📊 Отчетность

Система предоставляет следующие отчеты:

- По периодам (день/неделя/месяц)
- По валютам и сетям
- По офисам и кассирам
- Воронка статусов заявок
- Экспорт в CSV/XLSX

## 🚦 SLA и уведомления

- Автоматическое отслеживание просроченных заявок
- Настраиваемые сроки SLA по статусам
- In-app уведомления
- Cron задачи для фоновой обработки

## 🛠️ Технологии

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL, Prisma ORM
- **Authentication**: JWT, bcrypt
- **State Management**: React Context, TanStack Query
- **Testing**: Vitest, Testing Library
- **Deployment**: Vercel/Netlify ready

## 📝 Лицензия

Этот проект создан для демонстрации и не предназначен для использования в production без дополнительной настройки безопасности и оптимизации.