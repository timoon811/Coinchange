#!/usr/bin/env node

/**
 * Скрипт для генерации безопасных ключей для проекта CryptoCoinChange
 * Запуск: node generate-keys.js
 */

import crypto from 'crypto'

console.log('🔐 Генерация безопасных ключей для CryptoCoinChange')
console.log('=' .repeat(60))

// Генерация JWT секрета (минимум 32 символа)
const jwtSecret = crypto.randomBytes(32).toString('base64')
console.log('JWT_SECRET:', jwtSecret)
console.log('Длина:', jwtSecret.length, 'символов')
console.log()

// Генерация ключа шифрования (32 байта = 64 hex символа)
const encryptionKey = crypto.randomBytes(32).toString('hex')
console.log('ENCRYPTION_KEY:', encryptionKey)
console.log('Длина:', encryptionKey.length, 'символов')
console.log()

// Генерация NextAuth секрета
const nextAuthSecret = crypto.randomBytes(32).toString('base64')
console.log('NEXTAUTH_SECRET:', nextAuthSecret)
console.log('Длина:', nextAuthSecret.length, 'символов')
console.log()

console.log('📋 Инструкции:')
console.log('1. Скопируйте эти значения в ваш .env файл')
console.log('2. Никогда не коммитьте реальные ключи в git')
console.log('3. Используйте разные ключи для разработки и продакшена')
console.log('4. Храните ключи в безопасном месте (vault, secret manager)')
console.log()

console.log('⚠️  Важно:')
console.log('- JWT_SECRET должен быть минимум 32 символа')
console.log('- ENCRYPTION_KEY должен быть ровно 64 hex символа')
console.log('- Меняйте ключи при компрометации')
console.log('- Используйте сильные случайные значения')
