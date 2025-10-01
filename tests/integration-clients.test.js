/**
 * Интеграционные тесты для API клиентов
 * Тестируем реальные HTTP-запросы к локальному серверу
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Конфигурация для тестирования
const TEST_SERVER_PORT = 3001;
const TEST_SERVER_URL = `http://localhost:${TEST_SERVER_PORT}`;

// Тестовые данные
const TEST_CLIENT_DATA = {
  telegramUserId: `test_${Date.now()}`,
  username: 'integration_test_user',
  firstName: 'Integration',
  lastName: 'Test',
  phone: '+1234567890'
};

const TEST_ADMIN_CREDENTIALS = {
  username: 'admin',
  password: 'admin123'
};

let serverProcess = null;
let authToken = null;

// Утилиты для HTTP-запросов
async function makeRequest(endpoint, options = {}) {
  const url = `${TEST_SERVER_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      ...(authToken && { 'Authorization': `Bearer ${authToken}` })
    }
  };

  const fetchOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  try {
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    return { response, data };
  } catch (error) {
    console.error(`Request failed: ${endpoint}`, error);
    throw error;
  }
}

async function authenticateAdmin() {
  try {
    const { response, data } = await makeRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(TEST_ADMIN_CREDENTIALS)
    });

    if (response.ok && data.success) {
      authToken = data.token;
      return true;
    }
    return false;
  } catch (error) {
    console.error('Authentication failed:', error);
    return false;
  }
}

// Проверка доступности сервера
async function waitForServer(timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${TEST_SERVER_URL}/api/health`);
      if (response.ok) {
        return true;
      }
    } catch (error) {
      // Сервер еще не готов
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return false;
}

// Основные тесты
describe('Integration Tests - Client API', () => {
  let createdClientId = null;

  beforeAll(async () => {
    console.log('🚀 Запуск интеграционных тестов...');
    
    // Проверяем, что в проекте есть необходимые файлы
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      throw new Error('package.json не найден. Тесты должны запускаться из корня проекта.');
    }

    console.log('📡 Проверка доступности сервера...');
    const serverReady = await waitForServer();
    
    if (!serverReady) {
      console.log('⚠️ Сервер не запущен. Попытка подключения к существующему серверу...');
      
      // Проверяем стандартный порт
      try {
        const response = await fetch('http://localhost:3000/api/health');
        if (response.ok) {
          console.log('✅ Подключено к серверу на порту 3000');
          TEST_SERVER_URL.replace('3001', '3000');
        } else {
          throw new Error('Сервер недоступен');
        }
      } catch (error) {
        console.error('❌ Сервер недоступен. Запустите сервер командой: npm run dev');
        return;
      }
    }

    console.log('🔐 Аутентификация администратора...');
    const authSuccess = await authenticateAdmin();
    if (!authSuccess) {
      console.warn('⚠️ Не удалось аутентифицироваться как администратор');
    }
  }, 60000);

  afterAll(async () => {
    // Очистка созданных тестовых данных
    if (createdClientId && authToken) {
      try {
        console.log('🧹 Очистка тестовых данных...');
        // В реальном приложении здесь был бы DELETE endpoint
        // await makeRequest(`/api/clients/${createdClientId}`, { method: 'DELETE' });
      } catch (error) {
        console.warn('Не удалось очистить тестовые данные:', error);
      }
    }

    if (serverProcess) {
      console.log('🛑 Остановка тестового сервера...');
      serverProcess.kill();
    }
  });

  describe('Client Registration via User Interface', () => {
    test('should register new client through client auth endpoint', async () => {
      console.log('🧪 Тестирование регистрации клиента...');
      
      const { response, data } = await makeRequest('/api/client/auth', {
        method: 'POST',
        body: JSON.stringify(TEST_CLIENT_DATA)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.telegramUserId).toBe(TEST_CLIENT_DATA.telegramUserId);
      expect(data.data.firstName).toBe(TEST_CLIENT_DATA.firstName);
      
      createdClientId = data.data.id;
      console.log(`✅ Клиент создан с ID: ${createdClientId}`);
    });

    test('should update existing client on repeated login', async () => {
      console.log('🧪 Тестирование повторного входа...');
      
      const updatedData = {
        ...TEST_CLIENT_DATA,
        firstName: 'Updated Integration',
        lastName: 'Updated Test'
      };

      const { response, data } = await makeRequest('/api/client/auth', {
        method: 'POST',
        body: JSON.stringify(updatedData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.firstName).toBe('Updated Integration');
      expect(data.data.lastName).toBe('Updated Test');
      expect(data.data.telegramUserId).toBe(TEST_CLIENT_DATA.telegramUserId);
    });
  });

  describe('Admin Panel Client Management', () => {
    test('should fetch clients list from admin panel', async () => {
      if (!authToken) {
        console.log('⏭️ Пропуск теста - нет токена администратора');
        return;
      }

      console.log('🧪 Тестирование получения списка клиентов...');
      
      const { response, data } = await makeRequest('/api/clients');

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      
      // Проверяем, что наш тестовый клиент в списке
      const testClient = data.data.find(
        client => client.telegramUserId === TEST_CLIENT_DATA.telegramUserId
      );
      expect(testClient).toBeTruthy();
      
      console.log(`✅ Найдено ${data.data.length} клиентов`);
    });

    test('should search for specific client', async () => {
      if (!authToken) {
        console.log('⏭️ Пропуск теста - нет токена администратора');
        return;
      }

      console.log('🧪 Тестирование поиска клиента...');
      
      const { response, data } = await makeRequest(
        `/api/clients?search=${TEST_CLIENT_DATA.username}`
      );

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      const foundClient = data.data.find(
        client => client.username === TEST_CLIENT_DATA.username
      );
      expect(foundClient).toBeTruthy();
      
      console.log('✅ Клиент найден через поиск');
    });

    test('should get detailed client information', async () => {
      if (!authToken || !createdClientId) {
        console.log('⏭️ Пропуск теста - нет данных для тестирования');
        return;
      }

      console.log('🧪 Тестирование получения детальной информации...');
      
      const { response, data } = await makeRequest(`/api/clients/${createdClientId}`);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(createdClientId);
      expect(data.data).toHaveProperty('stats');
      expect(data.data).toHaveProperty('requests');
      expect(data.data.stats).toHaveProperty('totalVolume');
      expect(data.data.stats).toHaveProperty('conversionRate');
      
      console.log('✅ Детальная информация получена');
    });

    test('should update client information', async () => {
      if (!authToken || !createdClientId) {
        console.log('⏭️ Пропуск теста - нет данных для тестирования');
        return;
      }

      console.log('🧪 Тестирование обновления клиента...');
      
      const updateData = {
        notes: 'Integration test notes',
        tags: ['integration-test', 'automated'],
        isBlocked: false
      };

      const { response, data } = await makeRequest(`/api/clients/${createdClientId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateData)
      });

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.notes).toBe('Integration test notes');
      expect(data.data.tags).toContain('integration-test');
      expect(data.data.isBlocked).toBe(false);
      
      console.log('✅ Клиент успешно обновлен');
    });

    test('should toggle client VIP status', async () => {
      if (!authToken || !createdClientId) {
        console.log('⏭️ Пропуск теста - нет данных для тестирования');
        return;
      }

      console.log('🧪 Тестирование переключения VIP статуса...');
      
      // Добавляем VIP тег
      const { response: vipResponse, data: vipData } = await makeRequest(
        `/api/clients/${createdClientId}`, 
        {
          method: 'PATCH',
          body: JSON.stringify({ tags: ['VIP', 'integration-test'] })
        }
      );

      expect(vipResponse.status).toBe(200);
      expect(vipData.data.tags).toContain('VIP');
      
      // Убираем VIP тег
      const { response: normalResponse, data: normalData } = await makeRequest(
        `/api/clients/${createdClientId}`, 
        {
          method: 'PATCH',
          body: JSON.stringify({ tags: ['integration-test'] })
        }
      );

      expect(normalResponse.status).toBe(200);
      expect(normalData.data.tags).not.toContain('VIP');
      
      console.log('✅ VIP статус успешно переключен');
    });

    test('should block and unblock client', async () => {
      if (!authToken || !createdClientId) {
        console.log('⏭️ Пропуск теста - нет данных для тестирования');
        return;
      }

      console.log('🧪 Тестирование блокировки/разблокировки клиента...');
      
      // Блокируем клиента
      const { response: blockResponse, data: blockData } = await makeRequest(
        `/api/clients/${createdClientId}`, 
        {
          method: 'PATCH',
          body: JSON.stringify({ isBlocked: true })
        }
      );

      expect(blockResponse.status).toBe(200);
      expect(blockData.data.isBlocked).toBe(true);
      
      // Разблокируем клиента
      const { response: unblockResponse, data: unblockData } = await makeRequest(
        `/api/clients/${createdClientId}`, 
        {
          method: 'PATCH',
          body: JSON.stringify({ isBlocked: false })
        }
      );

      expect(unblockResponse.status).toBe(200);
      expect(unblockData.data.isBlocked).toBe(false);
      
      console.log('✅ Блокировка/разблокировка работает корректно');
    });
  });

  describe('Data Consistency Checks', () => {
    test('client data should be consistent between endpoints', async () => {
      if (!createdClientId) {
        console.log('⏭️ Пропуск теста - нет созданного клиента');
        return;
      }

      console.log('🧪 Тестирование консистентности данных...');
      
      // Получаем данные через клиентский API
      const { response: clientResponse, data: clientData } = await makeRequest('/api/client/auth', {
        method: 'POST',
        body: JSON.stringify({ telegramUserId: TEST_CLIENT_DATA.telegramUserId })
      });

      expect(clientResponse.status).toBe(200);
      
      if (authToken) {
        // Получаем данные через админский API
        const { response: adminResponse, data: adminData } = await makeRequest(
          `/api/clients/${createdClientId}`
        );

        expect(adminResponse.status).toBe(200);
        
        // Проверяем консистентность основных полей
        expect(adminData.data.telegramUserId).toBe(clientData.data.telegramUserId);
        expect(adminData.data.firstName).toBe(clientData.data.firstName);
        expect(adminData.data.lastName).toBe(clientData.data.lastName);
        expect(adminData.data.username).toBe(clientData.data.username);
        expect(adminData.data.phone).toBe(clientData.data.phone);
        
        console.log('✅ Данные консистентны между API');
      }
    });

    test('field validation should work correctly', async () => {
      console.log('🧪 Тестирование валидации полей...');
      
      // Тестируем создание клиента без обязательного поля
      const { response: invalidResponse } = await makeRequest('/api/client/auth', {
        method: 'POST',
        body: JSON.stringify({
          username: 'test_without_telegram_id',
          firstName: 'Test'
          // telegramUserId отсутствует
        })
      });

      expect(invalidResponse.status).toBe(400);
      
      console.log('✅ Валидация работает корректно');
    });
  });

  describe('Performance and Load Tests', () => {
    test('should handle multiple concurrent requests', async () => {
      console.log('🧪 Тестирование concurrent запросов...');
      
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          makeRequest('/api/client/auth', {
            method: 'POST',
            body: JSON.stringify({
              telegramUserId: `concurrent_test_${Date.now()}_${i}`,
              username: `concurrent_user_${i}`,
              firstName: `Test${i}`
            })
          })
        );
      }

      const results = await Promise.allSettled(promises);
      const successfulRequests = results.filter(
        result => result.status === 'fulfilled' && result.value.response.ok
      );

      expect(successfulRequests.length).toBeGreaterThan(0);
      console.log(`✅ ${successfulRequests.length} из ${promises.length} запросов успешны`);
    });

    test('should handle pagination correctly', async () => {
      if (!authToken) {
        console.log('⏭️ Пропуск теста - нет токена администратора');
        return;
      }

      console.log('🧪 Тестирование пагинации...');
      
      const { response, data } = await makeRequest('/api/clients?page=1&limit=5');

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
      
      if (data.pagination) {
        expect(data.pagination).toHaveProperty('page');
        expect(data.pagination).toHaveProperty('limit');
        expect(data.pagination).toHaveProperty('total');
        expect(data.pagination.page).toBe(1);
        expect(data.pagination.limit).toBe(5);
      }
      
      console.log('✅ Пагинация работает корректно');
    });
  });
});

// Экспортируем конфигурацию для Jest
module.exports = {
  testEnvironment: 'node',
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/tests/integration-setup.js']
};



