import { test, expect } from '../integration-setup'

test.describe('Authentication Flow', () => {
  test('should login user successfully', async ({ page }) => {
    // Переходим на страницу входа
    await page.goto('/auth/login')

    // Проверяем наличие формы входа
    await expect(page.locator('h1').filter({ hasText: 'Вход в систему' })).toBeVisible()

    // Заполняем форму
    await page.locator('[name="username"]').fill('testuser')
    await page.locator('[name="password"]').fill('testpassword123')

    // Отправляем форму
    await page.locator('button[type="submit"]').click()

    // Проверяем успешный вход (редирект на дашборд)
    await expect(page).toHaveURL('/dashboard')
  })

  test('should handle login errors', async ({ page }) => {
    await page.goto('/auth/login')

    // Проверяем валидацию пустых полей
    await page.locator('button[type="submit"]').click()
    await expect(page.locator('text=Имя пользователя обязательно')).toBeVisible()
    await expect(page.locator('text=Пароль должен содержать минимум 6 символов')).toBeVisible()

    // Проверяем ошибку неверных учетных данных
    await page.locator('[name="username"]').fill('wronguser')
    await page.locator('[name="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    await expect(page.locator('text=Неверные учетные данные')).toBeVisible()
  })

  test('should handle session management', async ({ page, authenticatedUser }) => {
    // Пользователь уже авторизован через fixture

    // Переходим на защищенную страницу
    await page.goto('/dashboard')

    // Проверяем, что пользователь авторизован
    await expect(page.locator(`text=${authenticatedUser.firstName}`)).toBeVisible()

    // Проверяем доступ к API с токеном
    const response = await page.request.get('/api/auth/me')
    expect(response.ok()).toBeTruthy()

    const userData = await response.json()
    expect(userData.success).toBe(true)
    expect(userData.user.id).toBe(authenticatedUser.id)
  })

  test('should handle logout', async ({ page, authenticatedUser }) => {
    await page.goto('/dashboard')

    // Находим и нажимаем кнопку выхода
    const logoutButton = page.locator('button').filter({ hasText: 'Выйти' })
    await logoutButton.click()

    // Проверяем редирект на страницу входа
    await expect(page).toHaveURL('/auth/login')

    // Проверяем, что токен удален
    const token = await page.evaluate(() => localStorage.getItem('auth-token'))
    expect(token).toBeNull()
  })

  test('should protect routes from unauthorized access', async ({ page }) => {
    // Пытаемся перейти на защищенную страницу без авторизации
    await page.goto('/dashboard')

    // Должны быть перенаправлены на страницу входа
    await expect(page).toHaveURL('/auth/login')
  })

  test('should handle rate limiting', async ({ page }) => {
    await page.goto('/auth/login')

    // Множественные попытки входа
    for (let i = 0; i < 10; i++) {
      await page.locator('[name="username"]').fill(`user${i}`)
      await page.locator('[name="password"]').fill('password123')
      await page.locator('button[type="submit"]').click()

      // Небольшая задержка между попытками
      await page.waitForTimeout(100)
    }

    // Проверяем, что появилось сообщение о превышении лимита
    await expect(page.locator('text=Слишком много запросов')).toBeVisible()
  })

  test('should validate password strength', async ({ page }) => {
    await page.goto('/auth/login')

    // Проверяем слабые пароли
    const weakPasswords = ['123', 'abc', 'password']

    for (const password of weakPasswords) {
      await page.locator('[name="username"]').fill('testuser')
      await page.locator('[name="password"]').fill(password)
      await page.locator('button[type="submit"]').click()

      await expect(page.locator('text=Пароль должен содержать минимум 6 символов')).toBeVisible()
    }
  })
})
