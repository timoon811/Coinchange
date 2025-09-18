"use client"

import { useState, useEffect } from 'react'
import {
  Users,
  Building2,
  Percent,
  Shield,
  FileText,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Check,
  X,
  Settings as SettingsIcon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { UserRole } from '@prisma/client'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import type { UserUpdateData, OfficeUpdateData } from '@/lib/types'

// Типы данных
interface User {
  id: string
  username: string
  email: string | null
  firstName: string
  lastName: string | null
  role: UserRole
  officeIds: string[]
  isActive: boolean
  requestsCount: number
  createdAt: string
}

interface Office {
  id: string
  name: string
  city: string
  address: string
  phone: string | null
  email: string | null
  activeCurrencies: string[]
  activeNetworks: string[]
  isActive: boolean
  requestsCount: number
  createdAt: string
}

interface CommissionRule {
  id: string
  name: string
  description: string | null
  scope: string
  conditions?: Record<string, unknown>
  percent: number | null
  fixed: number | null
  priority: number
  isActive: boolean
  createdAt: string
}

export default function SettingsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('users')

  // Получаем параметр tab из URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const tab = urlParams.get('tab')
    if (tab && ['users', 'offices', 'commissions', 'permissions', 'system'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [])

  // Проверяем права доступа
  if (!user || user.role !== UserRole.ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Недостаточно прав</h2>
          <p className="text-muted-foreground">
            У вас нет прав доступа к админ панели
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Админ панель</h1>
          <p className="text-muted-foreground">
            Централизованное управление пользователями, офисами, комиссиями, правами доступа и системными настройками
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-2" />
            Пользователи
          </TabsTrigger>
          <TabsTrigger value="offices">
            <Building2 className="h-4 w-4 mr-2" />
            Офисы
          </TabsTrigger>
          <TabsTrigger value="commissions">
            <Percent className="h-4 w-4 mr-2" />
            Комиссии
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 mr-2" />
            Права
          </TabsTrigger>
          <TabsTrigger value="system">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Система
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="offices" className="space-y-4">
          <OfficesTab />
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <CommissionsTab />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab />
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          <SystemTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Компонент управления пользователями
function UsersTab() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<{
    username: string
    email: string
    firstName: string
    lastName: string
    password: string
    role: UserRole
    officeIds: string[]
    isActive: boolean
  }>({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
    password: '',
    role: UserRole.CASHIER,
    officeIds: [],
    isActive: true,
  })

  const { execute: fetchUsers, loading: fetchLoading } = useApi<User[]>()
  const { execute: createUser, loading: createLoading } = useApi<User>()
  const { execute: updateUser, loading: updateLoading } = useApi<User>()
  const { execute: deleteUser, loading: deleteLoading } = useApi()

  // Загрузка пользователей
  const loadUsers = async () => {
    const result = await fetchUsers('/api/admin/users')
    if (result) {
      setUsers(result)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  // Создание пользователя
  const handleCreateUser = async () => {
    const result = await createUser('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(formData),
    })

    if (result) {
      setCreateDialogOpen(false)
      setFormData({
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        role: UserRole.CASHIER,
        officeIds: [],
        isActive: true,
      })
      loadUsers()
    }
  }

  // Редактирование пользователя
  const handleEditUser = (user: User) => {
    setSelectedUser(user)
    setFormData({
      username: user.username,
      email: user.email || '',
      firstName: user.firstName,
      lastName: user.lastName || '',
      password: '',
      role: user.role,
      officeIds: user.officeIds,
      isActive: user.isActive,
    })
    setEditDialogOpen(true)
  }

  const handleUpdateUser = async () => {
    if (!selectedUser) return

    const result = await updateUser(`/api/admin/users/${selectedUser.id}`, {
      method: 'PATCH',
      body: JSON.stringify(formData),
    })

    if (result) {
      setEditDialogOpen(false)
      setSelectedUser(null)
      loadUsers()
    }
  }

  // Удаление пользователя
  const handleDeleteUser = async (userId: string) => {
    const result = await deleteUser(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    })

    if (result) {
      loadUsers()
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Управление пользователями</CardTitle>
              <CardDescription>
                Создание, редактирование и удаление пользователей системы
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить пользователя
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Создать пользователя</DialogTitle>
                  <DialogDescription>
                    Заполните информацию о новом пользователе
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="create-username">Логин</Label>
                      <Input
                        id="create-username"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="username"
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-email">Email</Label>
                      <Input
                        id="create-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="user@example.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="create-firstName">Имя</Label>
                      <Input
                        id="create-firstName"
                        value={formData.firstName}
                        onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="Иван"
                      />
                    </div>
                    <div>
                      <Label htmlFor="create-lastName">Фамилия</Label>
                      <Input
                        id="create-lastName"
                        value={formData.lastName}
                        onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Иванов"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="create-password">Пароль</Label>
                    <Input
                      id="create-password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                    />
                  </div>

                  <div>
                    <Label htmlFor="create-role">Роль</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UserRole.ADMIN}>Администратор</SelectItem>
                        <SelectItem value={UserRole.CASHIER}>Кассир</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateUser} disabled={createLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск пользователей..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Заявок</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Дата создания</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(users) && users
                .filter(user =>
                  user.username.toLowerCase().includes(search.toLowerCase()) ||
                  user.firstName.toLowerCase().includes(search.toLowerCase()) ||
                  user.lastName?.toLowerCase().includes(search.toLowerCase()) ||
                  user.email?.toLowerCase().includes(search.toLowerCase())
                )
                .map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          @{user.username}
                        </div>
                        {user.email && (
                          <div className="text-xs text-muted-foreground">
                            {user.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.role === UserRole.ADMIN ? "default" : "secondary"}>
                        {user.role === UserRole.ADMIN ? 'Администратор' : 'Кассир'}
                      </Badge>
                    </TableCell>
                    <TableCell>{user.requestsCount}</TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "default" : "destructive"}>
                        {user.isActive ? 'Активен' : 'Заблокирован'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString('ru-RU')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <SettingsIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditUser(user)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Диалог редактирования пользователя */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать пользователя</DialogTitle>
            <DialogDescription>
              Измените информацию о пользователе
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-firstName">Имя</Label>
                <Input
                  id="edit-firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="edit-lastName">Фамилия</Label>
                <Input
                  id="edit-lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="edit-role">Роль</Label>
              <Select
                value={formData.role}
                onValueChange={(value: UserRole) => setFormData(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UserRole.ADMIN}>Администратор</SelectItem>
                  <SelectItem value={UserRole.CASHIER}>Кассир</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="edit-isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                className="rounded"
              />
              <Label htmlFor="edit-isActive">Пользователь активен</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleUpdateUser} disabled={updateLoading}>
              <Check className="h-4 w-4 mr-2" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Компонент управления офисами
function OfficesTab() {
  const [offices, setOffices] = useState<Office[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    address: '',
    phone: '',
    email: '',
    activeCurrencies: [] as string[],
    activeNetworks: [] as string[],
  })

  const { execute: fetchOffices, loading: fetchLoading } = useApi<Office[]>()
  const { execute: createOffice, loading: createLoading } = useApi<Office>()

  // Загрузка офисов
  const loadOffices = async () => {
    const result = await fetchOffices('/api/admin/offices')
    if (result) {
      setOffices(result)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadOffices()
  }, [])

  // Создание офиса
  const handleCreateOffice = async () => {
    const result = await createOffice('/api/admin/offices', {
      method: 'POST',
      body: JSON.stringify(formData),
    })

    if (result) {
      setCreateDialogOpen(false)
      setFormData({
        name: '',
        city: '',
        address: '',
        phone: '',
        email: '',
        activeCurrencies: [],
        activeNetworks: [],
      })
      loadOffices()
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Управление офисами</CardTitle>
              <CardDescription>
                Создание и настройка офисов обслуживания клиентов
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить офис
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Создать офис</DialogTitle>
                  <DialogDescription>
                    Заполните информацию о новом офисе
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="office-name">Название</Label>
                    <Input
                      id="office-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Главный офис"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="office-city">Город</Label>
                      <Input
                        id="office-city"
                        value={formData.city}
                        onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                        placeholder="Москва"
                      />
                    </div>
                    <div>
                      <Label htmlFor="office-phone">Телефон</Label>
                      <Input
                        id="office-phone"
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="+7 (999) 123-45-67"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="office-address">Адрес</Label>
                    <Textarea
                      id="office-address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="ул. Ленина, 1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="office-email">Email</Label>
                    <Input
                      id="office-email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="office@example.com"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateOffice} disabled={createLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск офисов..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Офис</TableHead>
                <TableHead>Контакты</TableHead>
                <TableHead>Заявок</TableHead>
                <TableHead>Валюты</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.isArray(offices) && offices
                .filter(office =>
                  office.name.toLowerCase().includes(search.toLowerCase()) ||
                  office.city.toLowerCase().includes(search.toLowerCase()) ||
                  office.address.toLowerCase().includes(search.toLowerCase())
                )
                .map((office) => (
                  <TableRow key={office.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{office.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {office.city}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {office.address}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {office.phone && <div>{office.phone}</div>}
                        {office.email && <div>{office.email}</div>}
                      </div>
                    </TableCell>
                    <TableCell>{office.requestsCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {office.activeCurrencies.slice(0, 3).map((currency) => (
                          <Badge key={currency} variant="outline" className="text-xs">
                            {currency}
                          </Badge>
                        ))}
                        {office.activeCurrencies.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{office.activeCurrencies.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={office.isActive ? "default" : "destructive"}>
                        {office.isActive ? 'Активен' : 'Неактивен'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <SettingsIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

// Компонент управления комиссиями
function CommissionsTab() {
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scope: 'global',
    conditions: null as any,
    percent: null as number | null,
    fixed: null as number | null,
    priority: 0,
  })

  const { execute: fetchRules, loading: fetchLoading } = useApi<{rules: CommissionRule[], pagination: any}>()
  const { execute: createRule, loading: createLoading } = useApi<CommissionRule>()

  // Загрузка правил комиссий
  const loadRules = async () => {
    try {
      const result = await fetchRules('/api/admin/commission-rules')
      if (result && result.rules && Array.isArray(result.rules)) {
        setRules(result.rules)
      } else if (result && Array.isArray(result)) {
        setRules(result)
      } else {
        console.warn('Commission rules API returned unexpected data structure:', result)
        setRules([])
      }
    } catch (error) {
      console.error('Error loading commission rules:', error)
      setRules([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRules()
  }, [])

  // Создание правила
  const handleCreateRule = async () => {
    const result = await createRule('/api/admin/commission-rules', {
      method: 'POST',
      body: JSON.stringify(formData),
    })

    if (result) {
      setCreateDialogOpen(false)
      setFormData({
        name: '',
        description: '',
        scope: 'global',
        conditions: null,
        percent: null,
        fixed: null,
        priority: 0,
      })
      loadRules()
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Правила комиссий</CardTitle>
              <CardDescription>
                Настройка комиссий для разных типов операций
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Добавить правило
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Создать правило комиссии</DialogTitle>
                  <DialogDescription>
                    Настройте правило для расчета комиссий
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="rule-name">Название</Label>
                    <Input
                      id="rule-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Правило для VIP клиентов"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rule-description">Описание</Label>
                    <Textarea
                      id="rule-description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Описание правила"
                    />
                  </div>

                  <div>
                    <Label htmlFor="rule-scope">Область применения</Label>
                    <Select
                      value={formData.scope}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, scope: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="global">Глобальное</SelectItem>
                        <SelectItem value="office">По офису</SelectItem>
                        <SelectItem value="client">По клиенту</SelectItem>
                        <SelectItem value="direction">По направлению</SelectItem>
                        <SelectItem value="amount_range">По сумме</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="rule-percent">Процент (%)</Label>
                      <Input
                        id="rule-percent"
                        type="number"
                        step="0.01"
                        value={formData.percent || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          percent: e.target.value ? parseFloat(e.target.value) : null
                        }))}
                        placeholder="1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="rule-fixed">Фиксированная (USDT)</Label>
                      <Input
                        id="rule-fixed"
                        type="number"
                        step="0.01"
                        value={formData.fixed || ''}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          fixed: e.target.value ? parseFloat(e.target.value) : null
                        }))}
                        placeholder="10.00"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="rule-priority">Приоритет</Label>
                    <Input
                      id="rule-priority"
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        priority: parseInt(e.target.value) || 0
                      }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreateRule} disabled={createLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Область</TableHead>
                <TableHead>Комиссия</TableHead>
                <TableHead>Приоритет</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules && Array.isArray(rules) ? rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{rule.name}</div>
                      {rule.description && (
                        <div className="text-sm text-muted-foreground">
                          {rule.description}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {rule.scope === 'global' && 'Глобальное'}
                      {rule.scope === 'office' && 'По офису'}
                      {rule.scope === 'client' && 'По клиенту'}
                      {rule.scope === 'direction' && 'По направлению'}
                      {rule.scope === 'amount_range' && 'По сумме'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {rule.percent && <div>{rule.percent}%</div>}
                      {rule.fixed && <div>{rule.fixed} USDT</div>}
                      {!rule.percent && !rule.fixed && <div className="text-muted-foreground">-</div>}
                    </div>
                  </TableCell>
                  <TableCell>{rule.priority}</TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? "default" : "destructive"}>
                      {rule.isActive ? 'Активно' : 'Неактивно'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <SettingsIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Edit className="h-4 w-4 mr-2" />
                          Редактировать
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="h-4 w-4 mr-2" />
                          Удалить
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )) : null}
            </TableBody>
          </Table>

          {(!rules || rules.length === 0) && !loading && (
            <div className="text-center py-8 text-muted-foreground">
              Нет правил комиссий
            </div>
          )}
          
          {loading && (
            <div className="text-center py-8 text-muted-foreground">
              Загрузка...
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// Компонент управления правами доступа
function PermissionsTab() {
  const [permissions, setPermissions] = useState<any[]>([])
  const [rolePermissions, setRolePermissions] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CASHIER)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'PAGE_ACCESS' as const,
    resource: 'DASHBOARD' as const,
    conditions: '',
  })

  const { execute: fetchPermissions } = useApi<{permissions: any[], pagination: any}>()
  const { execute: fetchRolePermissions } = useApi<{rolePermissions: any[], groupedByRole: any}>()
  const { execute: createPermission, loading: createLoading } = useApi<any>()
  const { execute: updateRolePermissions, loading: updateLoading } = useApi<any>()

  // Загрузка всех прав
  const loadPermissions = async () => {
    try {
      const [permissionsResult, rolePermissionsResult] = await Promise.all([
        fetchPermissions('/api/admin/permissions?limit=100'),
        fetchRolePermissions('/api/admin/role-permissions')
      ])
      
      if (permissionsResult?.permissions) {
        setPermissions(permissionsResult.permissions)
      }
      
      if (rolePermissionsResult?.groupedByRole) {
        setRolePermissions(rolePermissionsResult.groupedByRole)
      }
    } catch (error) {
      console.error('Error loading permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPermissions()
  }, [])

  // Создание нового права
  const handleCreatePermission = async () => {
    const conditions = formData.conditions ? JSON.parse(formData.conditions) : null
    
    const result = await createPermission('/api/admin/permissions', {
      method: 'POST',
      body: JSON.stringify({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        resource: formData.resource,
        conditions,
      }),
    })

    if (result) {
      setCreateDialogOpen(false)
      setFormData({
        name: '',
        description: '',
        type: 'PAGE_ACCESS',
        resource: 'DASHBOARD',
        conditions: '',
      })
      loadPermissions()
    }
  }

  // Обновление прав роли
  const handleToggleRolePermission = async (permissionId: string, hasPermission: boolean) => {
    const currentPermissions = rolePermissions[selectedRole]?.map((rp: any) => rp.permissionId) || []
    
    let newPermissions
    if (hasPermission) {
      // Удаляем право
      newPermissions = currentPermissions.filter((id: string) => id !== permissionId)
    } else {
      // Добавляем право
      newPermissions = [...currentPermissions, permissionId]
    }

    const result = await updateRolePermissions('/api/admin/role-permissions', {
      method: 'PUT',
      body: JSON.stringify({
        role: selectedRole,
        permissionIds: newPermissions,
      }),
    })

    if (result) {
      loadPermissions()
    }
  }

  // Группировка прав по типам
  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.type]) {
      acc[permission.type] = []
    }
    acc[permission.type].push(permission)
    return acc
  }, {} as Record<string, any[]>)

  const typeLabels = {
    PAGE_ACCESS: 'Доступ к страницам',
    ACTION: 'Действия',
    FEATURE: 'Функционал'
  }

  const resourceLabels = {
    // Страницы
    DASHBOARD: 'Главная',
    REQUESTS: 'Заявки',
    CLIENTS: 'Клиенты',
    ACCOUNTING: 'Бухгалтерия',
    ANALYTICS: 'Аналитика',
    REPORTS: 'Отчеты',
    SETTINGS: 'Настройки',
    SLA: 'SLA',
    OFFICES: 'Офисы',
    USERS: 'Пользователи',
    SYSTEM: 'Система',
    // Подстраницы бухгалтерии
    ACCOUNTS: 'Счета',
    CURRENCIES: 'Валюты',
    DEPOSITS: 'Депозиты',
    EXCHANGE_RATES: 'Курсы валют',
    OPERATIONS: 'Операции',
    // Действия
    CREATE_REQUEST: 'Создание заявки',
    EDIT_REQUEST: 'Редактирование заявки',
    DELETE_REQUEST: 'Удаление заявки',
    ASSIGN_REQUEST: 'Назначение заявки',
    CREATE_CLIENT: 'Создание клиента',
    EDIT_CLIENT: 'Редактирование клиента',
    DELETE_CLIENT: 'Удаление клиента',
    CREATE_OPERATION: 'Создание операции',
    EDIT_OPERATION: 'Редактирование операции',
    DELETE_OPERATION: 'Удаление операции',
    CREATE_USER: 'Создание пользователя',
    EDIT_USER: 'Редактирование пользователя',
    DELETE_USER: 'Удаление пользователя',
    MANAGE_RATES: 'Управление курсами',
    MANAGE_ACCOUNTS: 'Управление счетами',
    MANAGE_OFFICES: 'Управление офисами',
    VIEW_REPORTS: 'Просмотр отчетов',
    EXPORT_REPORTS: 'Экспорт отчетов',
    SYSTEM_SETTINGS: 'Системные настройки',
    COMMISSION_RULES: 'Правила комиссий',
    // Функционал
    BULK_OPERATIONS: 'Массовые операции',
    ADVANCED_SEARCH: 'Расширенный поиск',
    AUDIT_LOGS: 'Логи аудита'
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-muted-foreground">
            Загрузка прав доступа...
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Управление правами роли */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Права доступа по ролям</CardTitle>
              <CardDescription>
                Настройка прав доступа для каждой роли пользователей
              </CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="role-select">Роль:</Label>
                <Select value={selectedRole} onValueChange={(value: UserRole) => setSelectedRole(value)}>
                  <SelectTrigger id="role-select" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UserRole.ADMIN}>Администратор</SelectItem>
                    <SelectItem value={UserRole.CASHIER}>Кассир</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([type, typePermissions]) => (
              <div key={type} className="space-y-3">
                <h3 className="font-semibold text-lg border-b pb-2">
                  {typeLabels[type as keyof typeof typeLabels] || type}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {typePermissions.map((permission) => {
                    const currentRolePermissions = rolePermissions[selectedRole] || []
                    const hasPermission = currentRolePermissions.some((rp: any) => rp.permissionId === permission.id)
                    
                    return (
                      <div key={permission.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                        <input
                          type="checkbox"
                          id={`permission-${permission.id}`}
                          checked={hasPermission}
                          onChange={() => handleToggleRolePermission(permission.id, hasPermission)}
                          disabled={updateLoading}
                          className="rounded"
                        />
                        <div className="flex-1">
                          <Label 
                            htmlFor={`permission-${permission.id}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {resourceLabels[permission.resource as keyof typeof resourceLabels] || permission.resource}
                          </Label>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Управление правами */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Управление правами</CardTitle>
              <CardDescription>
                Создание и редактирование прав доступа в системе
              </CardDescription>
            </div>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать право
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Создать новое право</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="create-name">Название</Label>
                    <Input
                      id="create-name"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Название права"
                    />
                  </div>

                  <div>
                    <Label htmlFor="create-description">Описание</Label>
                    <Input
                      id="create-description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Описание права"
                    />
                  </div>

                  <div>
                    <Label htmlFor="create-type">Тип</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, type: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAGE_ACCESS">Доступ к странице</SelectItem>
                        <SelectItem value="ACTION">Действие</SelectItem>
                        <SelectItem value="FEATURE">Функционал</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="create-resource">Ресурс</Label>
                    <Select
                      value={formData.resource}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, resource: value as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(resourceLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="create-conditions">Условия (JSON)</Label>
                    <Input
                      id="create-conditions"
                      value={formData.conditions}
                      onChange={(e) => setFormData(prev => ({ ...prev, conditions: e.target.value }))}
                      placeholder='{"maxAmount": 1000}'
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleCreatePermission} disabled={createLoading}>
                    <Plus className="h-4 w-4 mr-2" />
                    Создать
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead>Тип</TableHead>
                <TableHead>Ресурс</TableHead>
                <TableHead>Описание</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {permissions.map((permission) => (
                <TableRow key={permission.id}>
                  <TableCell className="font-medium">{permission.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {typeLabels[permission.type as keyof typeof typeLabels] || permission.type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {resourceLabels[permission.resource as keyof typeof resourceLabels] || permission.resource}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {permission.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={permission.isActive ? "default" : "destructive"}>
                      {permission.isActive ? 'Активно' : 'Неактивно'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {permissions.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Нет прав доступа
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// Компонент системных настроек
function SystemTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Системные настройки</CardTitle>
          <CardDescription>
            Глобальные параметры работы системы
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Telegram Bot Token</Label>
              <Input
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Настроено в переменных окружения
              </p>
            </div>

            <div className="space-y-2">
              <Label>Webhook Secret</Label>
              <Input
                type="password"
                placeholder="••••••••••••••••••••••••••••••••"
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Настроено в переменных окружения
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>База данных</Label>
              <Input value="PostgreSQL" disabled />
              <p className="text-xs text-muted-foreground">
                Подключение активно
              </p>
            </div>

            <div className="space-y-2">
              <Label>Резервное копирование</Label>
              <Input value="Автоматическое" disabled />
              <p className="text-xs text-muted-foreground">
                Ежедневно в 02:00
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Статистика системы</CardTitle>
          <CardDescription>
            Общая информация о работе системы
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center">
              <div className="text-2xl font-bold">1,234</div>
              <p className="text-sm text-muted-foreground">Всего заявок</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">89</div>
              <p className="text-sm text-muted-foreground">Активных пользователей</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">12</div>
              <p className="text-sm text-muted-foreground">Активных офисов</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">99.9%</div>
              <p className="text-sm text-muted-foreground">Uptime</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
