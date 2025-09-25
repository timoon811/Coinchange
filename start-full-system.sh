#!/bin/bash

# Скрипт для запуска объединенной системы CryptoCoinChange
# Включает пользовательский и админский интерфейсы в одном приложении

echo "🚀 Запуск полной системы CryptoCoinChange..."
echo ""

# Функция для проверки, запущен ли процесс на порту
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Функция для ожидания запуска сервиса
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=0

    echo "⏳ Ожидание запуска $service_name на порту $port..."
    
    while [ $attempt -lt $max_attempts ]; do
        if check_port $port; then
            echo "✅ $service_name запущен на порту $port"
            return 0
        fi
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name не запустился на порту $port за $max_attempts попыток"
    return 1
}

# Переходим в корневую директорию проекта
cd "$(dirname "$0")"

echo "📁 Рабочая директория: $(pwd)"
echo ""

# 1. Запускаем PostgreSQL через Docker
echo "🐘 Запуск PostgreSQL..."
if check_port 5433; then
    echo "✅ PostgreSQL уже запущен на порту 5433"
else
    echo "📦 Запуск PostgreSQL через Docker Compose..."
    docker-compose up -d postgres
    
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка при запуске PostgreSQL"
        exit 1
    fi
    
    # Ждем запуска PostgreSQL
    wait_for_service 5433 "PostgreSQL"
    if [ $? -ne 0 ]; then
        echo "❌ PostgreSQL не запустился"
        exit 1
    fi
fi

echo ""

# 2. Настраиваем объединенную систему
echo "🔧 Настройка объединенной системы..."
if [ ! -d "node_modules" ]; then
    echo "📦 Установка зависимостей..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Ошибка при установке зависимостей"
        exit 1
    fi
fi

# Генерируем Prisma клиент
echo "🔧 Генерация Prisma клиента..."
npx prisma generate
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при генерации Prisma клиента"
    exit 1
fi

# Применяем миграции
echo "🗄️ Применение миграций базы данных..."
npx prisma db push
if [ $? -ne 0 ]; then
    echo "❌ Ошибка при применении миграций"
    exit 1
fi

# Заполняем демо-данными
echo "🌱 Заполнение демо-данными..."
npm run db:seed
if [ $? -ne 0 ]; then
    echo "⚠️  Ошибка при заполнении демо-данными (продолжаем)"
fi

echo ""

# 3. Запускаем объединенную систему
echo "🚀 Запуск объединенной системы (порт 3000)..."
if check_port 3000; then
    echo "✅ Система уже запущена на порту 3000"
else
    echo "🔄 Запуск системы в фоне..."
    npm run dev > logs/app.log 2>&1 &
    APP_PID=$!
    echo "📝 PID системы: $APP_PID"
    
    # Ждем запуска системы
    wait_for_service 3000 "Объединенная система"
    if [ $? -ne 0 ]; then
        echo "❌ Система не запустилась"
        kill $APP_PID 2>/dev/null
        exit 1
    fi
fi

echo ""

# 4. Выводим информацию о запущенных сервисах
echo "🎉 Система успешно запущена!"
echo ""
echo "📊 Статус сервисов:"
echo "   🌐 Пользовательский интерфейс: http://localhost:3000"
echo "   🔧 Админский интерфейс:        http://localhost:3000/admin"
echo "   🐘 PostgreSQL:                localhost:5433"
echo ""
echo "👥 Учетные данные для админки:"
echo "   Администратор: admin / admin123"
echo "   Кассир 1:      cashier1 / cashier123"
echo "   Кассир 2:      cashier2 / cashier123"
echo ""
echo "📝 Логи:"
echo "   Объединенная система: logs/app.log"
echo ""
echo "🛑 Для остановки системы нажмите Ctrl+C"
echo ""

# Функция для корректного завершения
cleanup() {
    echo ""
    echo "🛑 Остановка системы..."
    
    if [ ! -z "$APP_PID" ]; then
        echo "🔄 Остановка системы (PID: $APP_PID)..."
        kill $APP_PID 2>/dev/null
    fi
    
    echo "✅ Система остановлена"
    exit 0
}

# Устанавливаем обработчик сигналов
trap cleanup SIGINT SIGTERM

# Ждем завершения
wait
