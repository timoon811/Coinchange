# Тестирование CryptoCRM

## Обзор

Проект использует **Vitest** для модульного тестирования с интеграцией **@testing-library/react** для тестирования React компонентов.

## Запуск тестов

```bash
# Запуск всех тестов
npm run test

# Запуск тестов в режиме наблюдения
npm run test:run

# Запуск тестов с UI
npm run test:ui

# Запуск тестов с покрытием кода
npm run test:coverage
```

## Структура тестов

### Модульные тесты

- **`/src/lib/__tests__/`** - Тесты утилит и сервисов
  - `auth.test.ts` - Тесты функций аутентификации
  - `encryption.test.ts` - Тесты функций шифрования
  - `cron.test.ts` - Тесты SLA монитора

### API тесты

- **`/src/app/api/**/__tests__/`** - Тесты API маршрутов
  - `auth/login.test.ts` - Тесты авторизации
  - `requests/route.test.ts` - Тесты API заявок

### Компонентные тесты

- **`/src/components/__tests__/`** - Тесты React компонентов
  - `notifications-dropdown.test.tsx` - Тесты компонента уведомлений

### Хуки тесты

- **`/src/hooks/__tests__/`** - Тесты React хуков
  - `use-api.test.ts` - Тесты API хука

## Покрытие кода

Минимальные требования к покрытию кода:
- **Statements**: 70%
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%

## Моки и фикстуры

### Глобальные моки

- **localStorage** - Мокируется для тестирования локального хранилища
- **fetch** - Мокируется для тестирования API вызовов
- **ResizeObserver/IntersectionObserver** - Мокируются для DOM API

### Библиотечные моки

- **bcryptjs** - Мокируется для тестирования хэширования паролей
- **jsonwebtoken** - Мокируется для тестирования JWT токенов
- **crypto** - Мокируется для тестирования шифрования
- **node-cron** - Мокируется для тестирования планировщика задач

## Лучшие практики

### 1. Название тестов

```typescript
describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash password successfully', async () => {
      // test implementation
    })
  })
})
```

### 2. Структура теста

```typescript
it('should handle success case', async () => {
  // Arrange
  const mockData = { /* test data */ }

  // Act
  const result = await functionToTest(mockData)

  // Assert
  expect(result).toEqual(expectedResult)
})
```

### 3. Мокирование

```typescript
const mockFunction = vi.fn().mockResolvedValue(mockResponse)
vi.mocked(moduleToMock).mockReturnValue(mockFunction)
```

### 4. Очистка после тестов

```typescript
beforeEach(() => {
  vi.clearAllMocks()
})
```

## CI/CD Интеграция

Тесты автоматически запускаются в CI/CD пайплайне:

```yaml
- name: Run tests
  run: npm run test:run

- name: Generate coverage report
  run: npm run test:coverage
```

## Отчеты о покрытии

Отчеты о покрытии генерируются в формате:
- **HTML** - `coverage/index.html`
- **JSON** - `coverage/coverage.json`
- **Text** - Вывод в консоль

## Исключения из покрытия

Следующие файлы исключены из требований покрытия:
- Конфигурационные файлы (`*.config.ts`)
- TypeScript декларации (`*.d.ts`)
- Макеты страниц (`layout.tsx`, `page.tsx`)
- Сторонние библиотеки (`node_modules/`)
- Файлы миграций базы данных (`prisma/`)

## Полезные команды

```bash
# Запуск конкретного теста
npm run test auth.test.ts

# Запуск тестов для конкретного компонента
npm run test notifications-dropdown.test.tsx

# Запуск с отладкой
npm run test -- --reporter=verbose

# Запуск с конкретным паттерном
npm run test -- --testNamePattern="should hash password"
```
