"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useClient } from "@/components/client/client-provider";
import { toast } from "sonner";
import { User, Phone, Mail, Calendar, Wallet, Settings, LogOut } from "lucide-react";
import { MobileNav } from "@/components/client/mobile-nav";

interface WalletAddress {
  id: string;
  currency: string;
  address: string;
  isVerified: boolean;
}

export default function ProfilePage() {
  const { client, logout } = useClient();
  const router = useRouter();
  const [walletAddresses, setWalletAddresses] = useState<WalletAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      router.push("/client");
      return;
    }
    setIsLoading(false);
  }, [client, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка профиля...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/client");
  };

  return (
    <div className="min-h-screen gradient-background overflow-x-hidden w-full">
      <div className="w-full max-w-4xl mx-auto responsive-container pb-44 md:pb-8">
        <div className="space-y-4 sm:space-y-6 responsive-padding">
          {/* Заголовок - Адаптивный */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Профиль</h1>
              <p className="text-sm sm:text-base text-muted-foreground">Управление вашим аккаунтом</p>
            </div>
            <Button 
              variant="outline" 
              onClick={handleLogout}
              className="w-full sm:w-auto mobile-button"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Выйти
            </Button>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Информация о клиенте */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <User className="h-5 w-5" />
                  Личная информация
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Основные данные вашего профиля
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Имя</Label>
                  <Input
                    id="firstName"
                    value={client.firstName || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Фамилия</Label>
                  <Input
                    id="lastName"
                    value={client.lastName || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={client.username || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Телефон</Label>
                  <Input
                    id="phone"
                    value={client.phone || ""}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Статистика */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Wallet className="h-5 w-5" />
                  Статистика
                </CardTitle>
                <CardDescription className="text-sm sm:text-base">
                  Ваша активность в системе
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Всего заявок</span>
                  <Badge variant="secondary">{client.totalRequests}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Общий объем</span>
                  <Badge variant="secondary">
                    {client.totalVolume ? `${client.totalVolume} ₽` : "0 ₽"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Статус</span>
                  <Badge variant={client.isBlocked ? "destructive" : "default"}>
                    {client.isBlocked ? "Заблокирован" : "Активен"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Адреса кошельков */}
          <Card className="card-glass mobile-card">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Wallet className="h-5 w-5" />
                Адреса кошельков
              </CardTitle>
              <CardDescription className="text-sm sm:text-base">
                Управление адресами для получения криптовалют
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {walletAddresses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">У вас пока нет сохраненных адресов кошельков</p>
                  <p className="text-xs sm:text-sm">Адреса будут добавлены автоматически при создании заявок</p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {walletAddresses.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-xl gap-2 sm:gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm sm:text-base">{wallet.currency}</span>
                          {wallet.isVerified && (
                            <Badge variant="default" className="text-xs">
                              Проверен
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-muted-foreground font-mono break-all">
                          {wallet.address}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}