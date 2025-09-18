"use client"

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth-provider'
import { useApi } from '@/hooks/use-api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  User, 
  Lock, 
  Mail, 
  Calendar, 
  Shield,
  Building2,
  Check,
  X,
  AlertCircle,
  Settings
} from 'lucide-react'
import { toast } from 'sonner'

interface ProfileData {
  id: string
  username: string
  email?: string | null
  firstName: string
  lastName?: string | null
  role: string
  officeIds: string[]
  isActive: boolean
  notificationPrefs?: any
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Состояние для редактирования профиля
  const [editMode, setEditMode] = useState(false)
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
  })

  // Состояние для смены пароля
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  // Настройки уведомлений
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    newRequestNotifications: true,
    overdueRequestNotifications: true,
    systemNotifications: true,
  })

  const { execute: fetchProfile } = useApi<ProfileData>()
  const { execute: updateProfile, loading: updateLoading } = useApi<ProfileData>()
  const { execute: changePassword, loading: passwordLoading } = useApi<any>()

  // Загрузка данных профиля
  const loadProfile = async () => {
    try {
      const result = await fetchProfile('/api/profile')
      if (result) {
        setProfileData(result)
        setProfileForm({
          firstName: result.firstName,
          lastName: result.lastName || '',
          email: result.email || '',
        })
        
        // Загружаем настройки уведомлений из профиля
        if (result.notificationPrefs) {
          setNotificationSettings({
            ...notificationSettings,
            ...result.notificationPrefs
          })
        }
      }
    } catch (error) {
      toast.error('Ошибка загрузки профиля')
      console.error('Profile loading error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  // Обновление профиля
  const handleUpdateProfile = async () => {
    const result = await updateProfile('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        email: profileForm.email,
        notificationPrefs: notificationSettings,
      }),
    })

    if (result) {
      setProfileData(result)
      setEditMode(false)
      await refreshUser()
      toast.success('Профиль успешно обновлен')
    }
  }

  // Смена пароля
  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Пароли не совпадают')
      return
    }

    const result = await changePassword('/api/profile', {
      method: 'POST',
      body: JSON.stringify(passwordForm),
    })

    if (result) {
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      })
      toast.success('Пароль успешно изменен')
    }
  }

  const getInitials = (firstName?: string, lastName?: string) => {
    const first = firstName?.charAt(0) || ''
    const last = lastName?.charAt(0) || ''
    return (first + last).toUpperCase() || 'U'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Загрузка профиля...</div>
        </div>
      </div>
    )
  }

  if (!profileData) {
    return (
      <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
        <div className="flex items-center justify-center py-8">
          <div className="text-muted-foreground">Ошибка загрузки профиля</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-6 p-4 pt-6 md:p-8">
      {/* Заголовок */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Мой профиль</h1>
          <p className="text-muted-foreground">
            Управление личной информацией и настройками аккаунта
          </p>
        </div>
      </div>

      {/* Информация о профиле */}
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {getInitials(profileData.firstName, profileData.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="flex items-center gap-2">
                {profileData.firstName} {profileData.lastName}
                {profileData.isActive ? (
                  <Badge variant="default" className="ml-2">
                    <Check className="h-3 w-3 mr-1" />
                    Активен
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="ml-2">
                    <X className="h-3 w-3 mr-1" />
                    Заблокирован
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  @{profileData.username}
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-4 w-4" />
                  {profileData.role === 'ADMIN' ? 'Администратор' : 'Кассир'}
                </span>
                {profileData.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {profileData.email}
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Табы */}
      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Профиль
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Пароль
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Уведомления
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Информация
          </TabsTrigger>
        </TabsList>

        {/* Редактирование профиля */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Личная информация</CardTitle>
                  <CardDescription>
                    Обновите свои личные данные и контактную информацию
                  </CardDescription>
                </div>
                {!editMode ? (
                  <Button onClick={() => setEditMode(true)}>
                    Редактировать
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMode(false)
                        setProfileForm({
                          firstName: profileData.firstName,
                          lastName: profileData.lastName || '',
                          email: profileData.email || '',
                        })
                      }}
                    >
                      Отмена
                    </Button>
                    <Button onClick={handleUpdateProfile} disabled={updateLoading}>
                      Сохранить
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">Имя *</Label>
                  <Input
                    id="firstName"
                    value={editMode ? profileForm.firstName : profileData.firstName}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, firstName: e.target.value }))}
                    disabled={!editMode}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Фамилия</Label>
                  <Input
                    id="lastName"
                    value={editMode ? profileForm.lastName : (profileData.lastName || '')}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, lastName: e.target.value }))}
                    disabled={!editMode}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={editMode ? profileForm.email : (profileData.email || '')}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!editMode}
                />
              </div>

              <div>
                <Label htmlFor="username">Имя пользователя</Label>
                <Input
                  id="username"
                  value={profileData.username}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Имя пользователя не может быть изменено
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Смена пароля */}
        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Смена пароля</CardTitle>
              <CardDescription>
                Обновите свой пароль для обеспечения безопасности аккаунта
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Новый пароль должен содержать минимум 8 символов
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="currentPassword">Текущий пароль *</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="newPassword">Новый пароль *</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword">Подтверждение пароля *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </div>

              <Button 
                onClick={handleChangePassword} 
                disabled={passwordLoading || !passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
                className="w-full"
              >
                {passwordLoading ? 'Изменение...' : 'Изменить пароль'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Настройки уведомлений */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Настройки уведомлений</CardTitle>
              <CardDescription>
                Выберите, какие уведомления вы хотите получать
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Email уведомления</div>
                    <div className="text-sm text-muted-foreground">
                      Получать уведомления на электронную почту
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Новые заявки</div>
                    <div className="text-sm text-muted-foreground">
                      Уведомления о новых заявках
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.newRequestNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, newRequestNotifications: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Просроченные заявки</div>
                    <div className="text-sm text-muted-foreground">
                      Уведомления о просроченных заявках
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.overdueRequestNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, overdueRequestNotifications: e.target.checked }))}
                    className="rounded"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Системные уведомления</div>
                    <div className="text-sm text-muted-foreground">
                      Важные системные сообщения
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationSettings.systemNotifications}
                    onChange={(e) => setNotificationSettings(prev => ({ ...prev, systemNotifications: e.target.checked }))}
                    className="rounded"
                  />
                </div>
              </div>

              <Button 
                onClick={handleUpdateProfile} 
                disabled={updateLoading}
                className="w-full"
              >
                Сохранить настройки
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Информация об аккаунте */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Информация об аккаунте</CardTitle>
              <CardDescription>
                Детальная информация о вашем аккаунте
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Роль в системе</Label>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span>{profileData.role === 'ADMIN' ? 'Администратор' : 'Кассир'}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Количество офисов</Label>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{profileData.officeIds.length}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Дата создания</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(profileData.createdAt)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Последнее обновление</Label>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{formatDate(profileData.updatedAt)}</span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>ID пользователя</Label>
                <div className="font-mono text-sm bg-muted p-2 rounded">
                  {profileData.id}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Офисы доступа</Label>
                <div className="flex flex-wrap gap-2">
                  {profileData.officeIds.map(officeId => (
                    <Badge key={officeId} variant="outline">
                      {officeId}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
