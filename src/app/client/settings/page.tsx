"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useClient } from "@/components/client/client-provider";
import { toast } from "sonner";
import { 
  Settings, 
  Bell, 
  Shield, 
  Palette, 
  Moon, 
  Sun,
  ArrowLeft,
  Save
} from "lucide-react";
import { useTheme } from "next-themes";
import { MobileNav } from "@/components/client/mobile-nav";

export default function SettingsPage() {
  const { client } = useClient();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    email: false,
    push: false,
    sms: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!client) {
      router.push("/client");
      return;
    }
    
    // Загружаем настройки уведомлений
    if (client.notificationPrefs) {
      setNotifications(client.notificationPrefs);
    }
  }, [client, router]);

  const handleNotificationChange = (type: keyof typeof notifications, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [type]: value,
    }));
  };

  const handleSaveSettings = async () => {
    if (!client) return;

    try {
      setIsLoading(true);
      
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notificationPrefs: notifications,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update settings");
      }

      toast.success("Настройки сохранены");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Ошибка сохранения настроек");
    } finally {
      setIsLoading(false);
    }
  };

  if (!client) {
    return null;
  }

  return (
    <div className="min-h-screen gradient-background overflow-x-hidden w-full">
      <div className="w-full max-w-2xl mx-auto responsive-container pb-44 md:pb-8">
        <div className="space-y-4 sm:space-y-6 responsive-padding">
          {/* Кнопка назад */}
          <Button 
            variant="outline" 
            onClick={() => router.push("/client/profile")}
            className="w-full sm:w-auto mobile-button"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к профилю
          </Button>

          {/* Заголовок */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Настройки</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Управление настройками аккаунта</p>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            {/* Тема приложения */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Palette className="h-5 w-5" />
                  Внешний вид
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Настройки темы и отображения
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">Тема приложения</Label>
                    <p className="text-xs text-muted-foreground">
                      Выберите светлую или темную тему
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("light")}
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Светлая
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTheme("dark")}
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Темная
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Уведомления */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Bell className="h-5 w-5" />
                  Уведомления
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Управление способами получения уведомлений
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="email-notifications" className="text-sm font-medium">
                        Email уведомления
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Получать уведомления на email
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={notifications.email}
                      onCheckedChange={(value) => handleNotificationChange("email", value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="push-notifications" className="text-sm font-medium">
                        Push уведомления
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Получать уведомления в браузере
                      </p>
                    </div>
                    <Switch
                      id="push-notifications"
                      checked={notifications.push}
                      onCheckedChange={(value) => handleNotificationChange("push", value)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="sms-notifications" className="text-sm font-medium">
                        SMS уведомления
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Получать уведомления по SMS
                      </p>
                    </div>
                    <Switch
                      id="sms-notifications"
                      checked={notifications.sms}
                      onCheckedChange={(value) => handleNotificationChange("sms", value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Безопасность */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Shield className="h-5 w-5" />
                  Безопасность
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Настройки безопасности аккаунта
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="text-sm text-muted-foreground">
                  <p>Ваш аккаунт защищен через Telegram авторизацию.</p>
                  <p className="mt-2">
                    Для дополнительной безопасности убедитесь, что ваш Telegram аккаунт 
                    защищен двухфакторной аутентификацией.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Кнопка сохранения */}
            <Button
              onClick={handleSaveSettings}
              disabled={isLoading}
              className="w-full mobile-button"
              variant="crypto"
              size="lg"
            >
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? "Сохранение..." : "Сохранить настройки"}
            </Button>
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
