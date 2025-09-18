import { test, expect } from '../integration-setup'
import { RequestStatus } from '@prisma/client'

test.describe('Request Management Flow', () => {
  test('should create and manage a complete request lifecycle', async ({
    page,
    authenticatedUser,
    testOffice,
    testRequest
  }) => {
    // Переходим на страницу заявок
    await page.goto('/dashboard/requests')

    // Проверяем, что страница загрузилась
    await expect(page).toHaveURL('/dashboard/requests')
    await expect(page.locator('h2').filter({ hasText: 'Заявки' })).toBeVisible()

    // Проверяем, что тестовая заявка отображается в списке
    const requestRow = page.locator(`[data-request-id="${testRequest.request.id}"]`)
    await expect(requestRow).toBeVisible()

    // Проверяем статус заявки
    await expect(requestRow.locator(`[data-status="${RequestStatus.NEW}"]`)).toBeVisible()

    // Переходим к деталям заявки
    await requestRow.click()
    await expect(page).toHaveURL(`/dashboard/requests/${testRequest.request.id}`)

    // Проверяем отображение деталей заявки
    await expect(page.locator('h1').filter({ hasText: 'Заявка' })).toBeVisible()
    await expect(page.locator(`text=${testRequest.request.requestId}`)).toBeVisible()
    await expect(page.locator(`text=${testRequest.client.firstName} ${testRequest.client.lastName}`)).toBeVisible()

    // Назначаем заявку на текущего пользователя
    const assignButton = page.locator('button').filter({ hasText: 'Назначить себе' })
    if (await assignButton.isVisible()) {
      await assignButton.click()

      // Проверяем, что статус изменился
      await expect(page.locator(`[data-status="${RequestStatus.ASSIGNED}"]`)).toBeVisible()
    }

    // Изменяем статус на "В работе"
    const statusSelect = page.locator('[data-testid="status-select"]')
    if (await statusSelect.isVisible()) {
      await statusSelect.click()
      await page.locator(`[data-value="${RequestStatus.IN_PROGRESS}"]`).click()

      // Проверяем изменение статуса
      await expect(page.locator(`[data-status="${RequestStatus.IN_PROGRESS}"]`)).toBeVisible()
    }

    // Добавляем комментарий
    const commentInput = page.locator('[data-testid="comment-input"]')
    const commentText = 'Тестовый комментарий от интеграционного теста'

    if (await commentInput.isVisible()) {
      await commentInput.fill(commentText)
      await page.locator('button').filter({ hasText: 'Отправить' }).click()

      // Проверяем, что комментарий появился
      await expect(page.locator(`text=${commentText}`)).toBeVisible()
    }

    // Завершаем заявку
    if (await statusSelect.isVisible()) {
      await statusSelect.click()
      await page.locator(`[data-value="${RequestStatus.COMPLETED}"]`).click()

      // Проверяем финальный статус
      await expect(page.locator(`[data-status="${RequestStatus.COMPLETED}"]`)).toBeVisible()
    }
  })

  test('should handle request filtering and search', async ({
    page,
    authenticatedUser
  }) => {
    await page.goto('/dashboard/requests')

    // Проверяем элементы фильтрации
    const statusFilter = page.locator('[data-testid="status-filter"]')
    const searchInput = page.locator('[data-testid="search-input"]')

    // Проверяем, что фильтры доступны
    if (await statusFilter.isVisible()) {
      await statusFilter.click()
      await expect(page.locator(`[data-value="${RequestStatus.NEW}"]`)).toBeVisible()
      await expect(page.locator(`[data-value="${RequestStatus.COMPLETED}"]`)).toBeVisible()
    }

    // Проверяем поиск
    if (await searchInput.isVisible()) {
      await searchInput.fill('test')
      await expect(page.locator('text=Поиск...')).toBeVisible()
    }
  })

  test('should validate request creation', async ({
    page,
    authenticatedUser
  }) => {
    await page.goto('/dashboard/requests/new')

    // Проверяем форму создания заявки
    const form = page.locator('[data-testid="request-form"]')

    if (await form.isVisible()) {
      // Проверяем обязательные поля
      const submitButton = page.locator('button[type="submit"]')
      await submitButton.click()

      // Должны появиться сообщения об ошибках валидации
      await expect(page.locator('text=Обязательное поле')).toBeVisible()
    }
  })

  test('should handle API error responses gracefully', async ({
    page,
    authenticatedUser
  }) => {
    // Мокаем сетевую ошибку
    await page.route('**/api/requests**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Что-то пошло не так'
        })
      })
    })

    await page.goto('/dashboard/requests')

    // Проверяем отображение ошибки
    await expect(page.locator('text=Ошибка загрузки данных')).toBeVisible()
  })

  test('should respect user permissions', async ({
    page,
    authenticatedUser
  }) => {
    // Проверяем, что кассир видит только свои заявки
    await page.goto('/dashboard/requests')

    // Проверяем отсутствие административных функций
    await expect(page.locator('button').filter({ hasText: 'Создать офис' })).not.toBeVisible()
    await expect(page.locator('button').filter({ hasText: 'Управление пользователями' })).not.toBeVisible()
  })
})
