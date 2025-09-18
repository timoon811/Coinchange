#!/bin/bash

echo "🚀 Запуск проекта CryptoCoinChange..."

# Проверка наличия Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker для запуска базы данных."
    exit 1
fi

# Запуск PostgreSQL через Docker Compose
echo "📦 Запуск базы данных..."
docker-compose up -d postgres

# Ожидание готовности базы данных
echo "⏳ Ожидание готовности базы данных..."
sleep 10

# Генерация Prisma клиента
echo "🔧 Генерация Prisma клиента..."
npm run db:generate

# Применение миграций
echo "📊 Применение миграций базы данных..."
npm run db:push

# Заполнение демо-данными
echo "🌱 Заполнение демо-данными..."
npm run db:seed

# Запуск сервера разработки
echo "🌐 Запуск сервера разработки..."
echo ""
echo "✅ Проект готов!"
echo "📱 Приложение доступно по адресу: http://localhost:3000"
echo "👤 Демо аккаунты:"
echo "   Администратор: admin / admin123"
echo "   Кассир 1: cashier1 / cashier123"
echo "   Кассир 2: cashier2 / cashier123"
echo ""
echo "🛑 Для остановки нажмите Ctrl+C"

npm run dev
