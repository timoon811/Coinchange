"use client"

import { useState } from 'react'
import { useApi } from '@/hooks/use-api'
import { toast } from 'sonner'
import {
  User,
  Phone,
  Tag,
  Shield,
  Save,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface CreateClientModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClientCreated?: () => void
}

export function CreateClientModal({ open, onOpenChange, onClientCreated }: CreateClientModalProps) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    phone: '',
    telegramUserId: '',
    tags: '',
    notes: '',
    isBlocked: false,
  })

  const { execute: createClient, loading: creating } = useApi()

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      username: '',
      phone: '',
      telegramUserId: '',
      tags: '',
      notes: '',
      isBlocked: false,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Валидация
    if (!formData.telegramUserId) {
      toast.error('Telegram ID обязателен')
      return
    }

    if (!formData.firstName && !formData.lastName && !formData.username) {
      toast.error('Укажите хотя бы имя, фамилию или username')
      return
    }

    const clientData = {
      firstName: formData.firstName || null,
      lastName: formData.lastName || null,
      username: formData.username || null,
      phone: formData.phone || null,
      telegramUserId: formData.telegramUserId,
      tags: formData.tags ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean) : [],
      notes: formData.notes || null,
      isBlocked: formData.isBlocked,
    }

    const result = await createClient('/api/clients', {
      method: 'POST',
      body: JSON.stringify(clientData),
      showSuccessToast: true,
      successMessage: 'Клиент успешно создан'
    })

    if (result) {
      onOpenChange(false)
      resetForm()
      onClientCreated?.()
    }
  }

  const updateField = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(openState) => {
      onOpenChange(openState)
      if (!openState) {
        resetForm()
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center">
            <User className="h-5 w-5 mr-2" />
            Добавление нового клиента
          </DialogTitle>
          <DialogDescription>
            Заполните информацию о клиенте
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Основная информация */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Основная информация</CardTitle>
              <CardDescription>Персональные данные клиента</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Имя</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder="Имя клиента"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Фамилия</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder="Фамилия клиента"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username Telegram</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) => updateField('username', e.target.value)}
                    placeholder="username (без @)"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramUserId">
                    Telegram ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="telegramUserId"
                    value={formData.telegramUserId}
                    onChange={(e) => updateField('telegramUserId', e.target.value)}
                    placeholder="123456789"
                    type="number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Телефон</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder="+7 (999) 123-45-67"
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Дополнительная информация */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Дополнительная информация</CardTitle>
              <CardDescription>Метки, заметки и настройки</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tags">Метки</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => updateField('tags', e.target.value)}
                    placeholder="VIP, regular, новый (через запятую)"
                    className="pl-10"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Разделите метки запятыми. Например: VIP, постоянный клиент, проблемный
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Заметки</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Внутренние заметки о клиенте"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isBlocked"
                  checked={formData.isBlocked}
                  onCheckedChange={(checked) => updateField('isBlocked', checked as boolean)}
                />
                <Label htmlFor="isBlocked" className="flex items-center cursor-pointer">
                  <Shield className="h-4 w-4 mr-2" />
                  Заблокировать клиента
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Кнопки действий */}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              <X className="h-4 w-4 mr-2" />
              Отмена
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Создание...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Создать клиента
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
