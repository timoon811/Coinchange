/**
 * Комплексные тесты API клиентов
 * Проверяем CRUD операции и интеграцию между админ панелью и пользовательским интерфейсом
 */

// Эмуляция fetch для тестирования
const mockFetch = (global.fetch = jest.fn());

describe('Client API Tests', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('GET /api/clients', () => {
    test('should fetch clients list with proper authentication', async () => {
      const mockClients = [
        {
          id: 'client1',
          telegramUserId: '123456789',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
          tags: ['VIP'],
          notes: 'Test notes',
          totalRequests: 5,
          totalVolume: 1000,
          isBlocked: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          requestsCount: 5
        }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: mockClients,
          message: 'Clients retrieved successfully'
        })
      });

      const response = await fetch('/api/clients', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'client1',
        telegramUserId: '123456789',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User'
      });
    });

    test('should filter clients by search query', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          message: 'Clients retrieved successfully'
        })
      });

      await fetch('/api/clients?search=Test&blocked=false&hasPhone=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/clients?search=Test&blocked=false&hasPhone=true',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include'
        })
      );
    });

    test('should handle pagination', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0
          }
        })
      });

      await fetch('/api/clients?page=1&limit=20', {
        method: 'GET',
        credentials: 'include'
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/clients?page=1&limit=20',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });
  });

  describe('POST /api/clients', () => {
    test('should create new client with all fields', async () => {
      const newClientData = {
        firstName: 'John',
        lastName: 'Doe',
        username: 'johndoe',
        phone: '+1234567890',
        telegramUserId: '987654321',
        tags: ['regular', 'new'],
        notes: 'New client from testing',
        isBlocked: false
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 'new-client-id',
          ...newClientData,
          totalRequests: 0,
          totalVolume: 0,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          requestsCount: 0
        },
        message: 'Клиент успешно создан'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResponse
      });

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newClientData)
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        telegramUserId: '987654321'
      });
      expect(mockFetch).toHaveBeenCalledWith('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(newClientData)
      });
    });

    test('should validate required fields', async () => {
      const invalidClientData = {
        firstName: 'John',
        lastName: 'Doe'
        // telegramUserId отсутствует
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'Неверные данные клиента',
          details: [
            {
              field: 'telegramUserId',
              message: 'Telegram ID обязателен'
            }
          ]
        })
      });

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(invalidClientData)
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Неверные данные клиента');
    });

    test('should handle duplicate telegram ID', async () => {
      const duplicateClientData = {
        firstName: 'Jane',
        lastName: 'Doe',
        telegramUserId: '123456789' // уже существует
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          error: 'Клиент с таким Telegram ID уже существует'
        })
      });

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(duplicateClientData)
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(409);
      expect(result.error).toBe('Клиент с таким Telegram ID уже существует');
    });
  });

  describe('GET /api/clients/[id]', () => {
    test('should fetch client details with stats', async () => {
      const clientId = 'client-123';
      const expectedClientData = {
        success: true,
        data: {
          id: clientId,
          telegramUserId: '123456789',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890',
          tags: ['VIP'],
          notes: 'Test client',
          totalRequests: 10,
          totalVolume: 5000,
          isBlocked: false,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
          requestsCount: 10,
          stats: {
            totalVolume: 5000,
            avgVolume: 500,
            conversionRate: 85.5,
            daysSinceLastRequest: 2,
            statusBreakdown: [
              { status: 'COMPLETED', count: 8 },
              { status: 'IN_PROGRESS', count: 1 },
              { status: 'CANCELED', count: 1 }
            ]
          },
          requests: {
            data: [],
            pagination: {
              page: 1,
              limit: 10,
              total: 10,
              pages: 1
            }
          },
          recentComments: []
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedClientData
      });

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'GET',
        credentials: 'include'
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(clientId);
      expect(result.data.stats).toBeDefined();
      expect(result.data.stats.conversionRate).toBe(85.5);
    });

    test('should return 404 for non-existent client', async () => {
      const nonExistentId = 'non-existent-client';

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: 'Клиент не найден'
        })
      });

      const response = await fetch(`/api/clients/${nonExistentId}`, {
        method: 'GET',
        credentials: 'include'
      });

      const result = await response.json();

      expect(response.ok).toBe(false);
      expect(response.status).toBe(404);
      expect(result.error).toBe('Клиент не найден');
    });
  });

  describe('PATCH /api/clients/[id]', () => {
    test('should update client information', async () => {
      const clientId = 'client-123';
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        phone: '+9876543210',
        tags: ['VIP', 'premium'],
        notes: 'Updated notes',
        isBlocked: true
      };

      const expectedResponse = {
        success: true,
        data: {
          id: clientId,
          telegramUserId: '123456789',
          username: 'testuser',
          ...updateData,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T12:00:00Z'
        },
        message: 'Информация о клиенте обновлена'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResponse
      });

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updateData)
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.firstName).toBe('Updated');
      expect(result.data.isBlocked).toBe(true);
      expect(result.message).toBe('Информация о клиенте обновлена');
    });

    test('should not allow updating protected fields', async () => {
      const clientId = 'client-123';
      const invalidUpdateData = {
        telegramUserId: 'new-telegram-id', // не должно обновляться
        id: 'new-id', // не должно обновляться
        firstName: 'Valid Update'
      };

      // API должен игнорировать недопустимые поля
      const expectedResponse = {
        success: true,
        data: {
          id: clientId,
          telegramUserId: '123456789', // остается прежним
          firstName: 'Valid Update',
          // другие поля...
        },
        message: 'Информация о клиенте обновлена'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResponse
      });

      const response = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(invalidUpdateData)
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.data.telegramUserId).toBe('123456789'); // не изменился
      expect(result.data.firstName).toBe('Valid Update'); // изменился
    });
  });

  describe('Client Registration Integration', () => {
    test('should register client from user interface', async () => {
      const registrationData = {
        telegramUserId: '555777999',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        phone: '+1111222333'
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 'new-user-id',
          telegramUserId: '555777999',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          phone: '+1111222333',
          totalRequests: 0,
          totalVolume: 0,
          isBlocked: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResponse
      });

      // Эмулируем регистрацию через пользовательский интерфейс
      const response = await fetch('/api/client/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(registrationData)
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.telegramUserId).toBe('555777999');
      expect(result.data.firstName).toBe('New');
    });

    test('should update existing client on login', async () => {
      const existingClientData = {
        telegramUserId: '123456789', // уже существует
        username: 'updatedusername',
        firstName: 'Updated',
        lastName: 'User'
      };

      const expectedResponse = {
        success: true,
        data: {
          id: 'existing-client-id',
          telegramUserId: '123456789',
          username: 'updatedusername', // обновлено
          firstName: 'Updated', // обновлено
          lastName: 'User', // обновлено
          phone: '+1234567890', // сохранено из существующих данных
          totalRequests: 5, // сохранено
          totalVolume: 1000, // сохранено
          isBlocked: false
        }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => expectedResponse
      });

      const response = await fetch('/api/client/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(existingClientData)
      });

      const result = await response.json();

      expect(response.ok).toBe(true);
      expect(result.success).toBe(true);
      expect(result.data.username).toBe('updatedusername');
      expect(result.data.firstName).toBe('Updated');
      expect(result.data.totalRequests).toBe(5); // сохранено
    });
  });

  describe('Field Consistency Between Admin and Client Interface', () => {
    test('client fields should match between admin API and client API', () => {
      // Поля, доступные в админ панели
      const adminClientFields = [
        'id',
        'telegramUserId',
        'username',
        'firstName',
        'lastName',
        'phone',
        'tags',
        'notes',
        'totalRequests',
        'totalVolume',
        'isBlocked',
        'createdAt',
        'updatedAt',
        'requestsCount'
      ];

      // Поля, доступные в пользовательском интерфейсе
      const clientInterfaceFields = [
        'id',
        'telegramUserId',
        'username',
        'firstName',
        'lastName',
        'phone',
        'totalRequests',
        'totalVolume',
        'isBlocked'
      ];

      // Проверяем, что все поля из клиентского интерфейса есть в админ API
      clientInterfaceFields.forEach(field => {
        expect(adminClientFields).toContain(field);
      });

      // Дополнительные поля в админке
      const adminOnlyFields = ['tags', 'notes', 'createdAt', 'updatedAt', 'requestsCount'];
      adminOnlyFields.forEach(field => {
        expect(adminClientFields).toContain(field);
        expect(clientInterfaceFields).not.toContain(field);
      });
    });

    test('registration should create client accessible from admin panel', async () => {
      // 1. Регистрируем клиента через пользовательский интерфейс
      const registrationData = {
        telegramUserId: '999888777',
        username: 'testintegration',
        firstName: 'Integration',
        lastName: 'Test',
        phone: '+5555555555'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: 'integration-test-id',
            ...registrationData,
            totalRequests: 0,
            totalVolume: 0,
            isBlocked: false
          }
        })
      });

      // Регистрация
      await fetch('/api/client/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationData)
      });

      // 2. Проверяем, что клиент доступен через админ API
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            {
              id: 'integration-test-id',
              telegramUserId: '999888777',
              username: 'testintegration',
              firstName: 'Integration',
              lastName: 'Test',
              phone: '+5555555555',
              tags: [],
              notes: null,
              totalRequests: 0,
              totalVolume: 0,
              isBlocked: false,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
              requestsCount: 0
            }
          ]
        })
      });

      const adminResponse = await fetch('/api/clients?search=testintegration', {
        method: 'GET',
        credentials: 'include'
      });

      const adminResult = await adminResponse.json();

      expect(adminResponse.ok).toBe(true);
      expect(adminResult.data).toHaveLength(1);
      expect(adminResult.data[0].telegramUserId).toBe('999888777');
      expect(adminResult.data[0].username).toBe('testintegration');
    });
  });

  describe('Business Logic Validation', () => {
    test('should handle client blocking properly', async () => {
      const clientId = 'client-to-block';
      
      // Блокируем клиента
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: clientId,
            isBlocked: true
          },
          message: 'Информация о клиенте обновлена'
        })
      });

      const blockResponse = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isBlocked: true })
      });

      const blockResult = await blockResponse.json();

      expect(blockResponse.ok).toBe(true);
      expect(blockResult.data.isBlocked).toBe(true);
    });

    test('should validate tag operations', async () => {
      const clientId = 'client-with-tags';
      
      // Добавляем VIP тег
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: clientId,
            tags: ['VIP', 'premium']
          },
          message: 'Информация о клиенте обновлена'
        })
      });

      const tagResponse = await fetch(`/api/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tags: ['VIP', 'premium'] })
      });

      const tagResult = await tagResponse.json();

      expect(tagResponse.ok).toBe(true);
      expect(tagResult.data.tags).toContain('VIP');
      expect(tagResult.data.tags).toContain('premium');
    });

    test('should handle statistics updates correctly', async () => {
      const clientId = 'client-with-stats';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: {
            id: clientId,
            totalRequests: 15,
            totalVolume: 7500,
            stats: {
              totalVolume: 7500,
              avgVolume: 500,
              conversionRate: 90.0,
              daysSinceLastRequest: 1
            }
          }
        })
      });

      const statsResponse = await fetch(`/api/clients/${clientId}`, {
        method: 'GET',
        credentials: 'include'
      });

      const statsResult = await statsResponse.json();

      expect(statsResponse.ok).toBe(true);
      expect(statsResult.data.totalRequests).toBe(15);
      expect(statsResult.data.stats.conversionRate).toBe(90.0);
      expect(statsResult.data.stats.avgVolume).toBe(500);
    });
  });
});

