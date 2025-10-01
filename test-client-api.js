// Тестовый скрипт для проверки API клиентов
const BASE_URL = 'http://localhost:3000'

const testClientCreation = async () => {
  try {
    console.log('🧪 Тестирование создания клиента...')
    
    // Сначала попробуем получить список клиентов (GET запрос)
    console.log('\n1️⃣ Тестируем GET /api/clients...')
    const getResponse = await fetch(`${BASE_URL}/api/clients`)
    console.log('📥 GET Статус:', getResponse.status)
    
    if (getResponse.status === 401) {
      console.log('🔐 Требуется аутентификация')
      
      // Попробуем войти как админ
      console.log('\n2️⃣ Пытаемся войти как админ...')
      const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123'
        })
      })
      
      console.log('📥 Login статус:', loginResponse.status)
      const loginResult = await loginResponse.json()
      console.log('📥 Login результат:', loginResult)
      
      if (loginResult.success && loginResult.token) {
        console.log('✅ Успешная аутентификация!')
        
        // Теперь попробуем создать клиента с токеном
        console.log('\n3️⃣ Создаем клиента с токеном...')
        
        const clientData = {
          firstName: 'Тест',
          lastName: 'Клиент',
          username: '@testuser',
          phone: '+1234567890',
          telegramUserId: '123456789',
          tags: ['VIP', 'тестовый'],
          notes: 'Тестовый клиент для проверки API',
          isBlocked: false
        }
        
        console.log('📤 Отправляем данные:', clientData)
        
        const createResponse = await fetch(`${BASE_URL}/api/clients`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${loginResult.token}`
          },
          body: JSON.stringify(clientData)
        })
        
        console.log('📥 Create статус:', createResponse.status)
        const createResult = await createResponse.text()
        console.log('📥 Create результат:', createResult)
        
        if (createResponse.ok) {
          console.log('✅ Клиент успешно создан!')
        } else {
          console.log('❌ Ошибка создания клиента')
        }
      } else {
        console.log('❌ Ошибка аутентификации')
      }
    } else {
      const getResult = await getResponse.text()
      console.log('📥 GET результат:', getResult)
    }
    
  } catch (error) {
    console.error('💥 Ошибка тестирования:', error)
  }
}

// Запускаем тест
testClientCreation()
