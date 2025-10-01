import fs from 'fs';

// Список файлов для исправления
const filesToFix = [
  'src/app/api/clients/route.ts',
  'src/app/api/clients/[id]/route.ts',
  'src/app/api/admin/commission-rules/route.ts',
  'src/app/api/admin/commission-rules/[id]/route.ts',
  'src/app/api/admin/offices/route.ts',
  'src/app/api/api/admin/offices/[id]/route.ts',
  'src/app/api/admin/users/route.ts',
  'src/app/api/admin/users/[id]/route.ts',
  'src/app/api/requests/[id]/comments/route.ts',
  'src/app/api/requests/[id]/route.ts',
  'src/app/api/sla/route.ts',
  'src/app/api/sla/check/route.ts',
  'src/app/api/reports/export/route.ts',
  'src/app/api/reports/overview/route.ts'
];

// Шаблон для замены старого кода аутентификации
const oldAuthPattern = /const userId = request\.headers\.get\('x-user-id'\)\s*const userRole = request\.headers\.get\('x-user-role'\) as UserRole\s*(?:const userOffices = JSON\.parse\(request\.headers\.get\('x-user-offices'\) \|\| '\[\]'\)\s*)?\s*if \(!userId\) \{\s*return NextResponse\.json\(\s*\{ error: 'Не авторизован' \},\s*\{ status: 401 \}\s*\)\s*\}/g;

const newAuthCode = `// Аутентифицируем пользователя
let payload: any

try {
  payload = await AuthService.authenticateRequest(request)
} catch (error) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Не авторизован' },
    { status: 401 }
  )
}

const userId = payload.userId
const userRole = payload.role as UserRole
const userOffices = payload.officeIds || []`;

filesToFix.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Заменяем старый паттерн на новый
    content = content.replace(oldAuthPattern, newAuthCode);

    fs.writeFileSync(filePath, content);
    console.log(`Исправлен файл: ${filePath}`);
  } else {
    console.log(`Файл не найден: ${filePath}`);
  }
});

console.log('Все файлы исправлены!');

