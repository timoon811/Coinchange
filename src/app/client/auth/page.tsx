"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useClient } from "@/components/client/client-provider";
import { toast } from "sonner";
import { ArrowUpDown, User, Phone, X, LogIn, UserPlus } from "lucide-react";

export default function AuthPage() {
  const { login, isLoading } = useClient();
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    telegramUserId: "",
    username: "",
    firstName: "",
    lastName: "",
    phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.telegramUserId) {
      toast.error("Введите Telegram ID");
      return;
    }

    // Для регистрации требуем больше данных
    if (!isLogin && !formData.firstName) {
      toast.error("Для регистрации укажите имя");
      return;
    }

    try {
      await login(
        formData.telegramUserId,
        formData.username || undefined,
        formData.firstName || undefined,
        formData.lastName || undefined,
        formData.phone || undefined
      );
      
      if (isLogin) {
        toast.success("Добро пожаловать!");
      } else {
        toast.success("Регистрация прошла успешно!");
      }
      
      router.push("/client");
    } catch (error) {
      console.error("Auth error:", error);
      if (isLogin) {
        toast.error("Ошибка входа в систему");
      } else {
        toast.error("Ошибка регистрации");
      }
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleClose = () => {
    router.push("/client");
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    // Очищаем форму при переключении режима
    setFormData({
      telegramUserId: "",
      username: "",
      firstName: "",
      lastName: "",
      phone: "",
    });
  };

  return (
    <div className="min-h-screen gradient-background flex items-center justify-center w-full overflow-x-hidden">
      <div className="w-full max-w-md responsive-container">
        <Card className="card-glass mobile-card relative">
          {/* Кнопка закрытия */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <CardHeader className="text-center px-4 sm:px-6 pt-12">
            <div className="flex justify-center mb-4">
              <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl gradient-primary shadow-lg">
                {isLogin ? (
                  <LogIn className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                ) : (
                  <UserPlus className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                )}
              </div>
            </div>
            <CardTitle className="text-xl sm:text-2xl font-bold">
              {isLogin ? "Вход в систему" : "Регистрация"}
            </CardTitle>
            <CardDescription className="text-sm sm:text-base">
              {isLogin 
                ? "Войдите в систему для создания заявок на обмен"
                : "Создайте аккаунт для работы с сервисом обмена"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4 w-full">
              <div className="space-y-2">
                <Label htmlFor="telegramUserId">Telegram ID *</Label>
                <Input
                  id="telegramUserId"
                  type="text"
                  placeholder="Введите ваш Telegram ID"
                  value={formData.telegramUserId}
                  onChange={(e) => handleInputChange("telegramUserId", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username (необязательно)</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="@username"
                  value={formData.username}
                  onChange={(e) => handleInputChange("username", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstName">
                  Имя {!isLogin && "*"}
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Ваше имя"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  required={!isLogin}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Фамилия (необязательно)</Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Ваша фамилия"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                />
              </div>

              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон (необязательно)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+7 (999) 123-45-67"
                    value={formData.phone}
                    onChange={(e) => handleInputChange("phone", e.target.value)}
                  />
                </div>
              )}

              <Button 
                type="submit" 
                variant="crypto"
                size="lg"
                className="w-full mobile-button" 
                disabled={isLoading}
              >
                {isLoading 
                  ? (isLogin ? "Вход..." : "Регистрация...") 
                  : (isLogin ? "Войти" : "Зарегистрироваться")
                }
              </Button>
            </form>

            {/* Переключатель режимов */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                {isLogin 
                  ? "Нет аккаунта?" 
                  : "Уже есть аккаунт?"
                }
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={toggleMode}
                className="w-full"
                disabled={isLoading}
              >
                {isLogin ? (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Зарегистрироваться
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Войти
                  </>
                )}
              </Button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-muted-foreground">
                {isLogin 
                  ? "Войдя в систему, вы сможете создавать заявки на обмен валют"
                  : "После регистрации вы получите доступ ко всем функциям сервиса"
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}