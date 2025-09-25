import { Suspense } from "react";
import { ExchangeRates } from "@/components/client/exchange-rates";
import { QuickExchange } from "@/components/client/quick-exchange";
import { Header } from "@/components/client/header";
import { MobileNav } from "@/components/client/mobile-nav";
import { ClientProvider } from "@/components/client/client-provider";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowUpDown, 
  Shield, 
  Clock, 
  Zap,
  CheckCircle
} from "lucide-react";

function HomePageContent() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Header />
      
      <main className="flex-1 space-y-6 p-4 pt-6 md:p-8 max-w-full overflow-x-hidden">
        {/* Hero Section - Упрощенный */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex justify-center">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-primary/5">
              <ArrowUpDown className="h-12 w-12 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Обмен криптовалют
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Быстрый, безопасный и выгодный обмен с лучшими курсами
          </p>
        </div>

        {/* Основной контент - Только обмен и курсы */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Quick Exchange - Главный блок */}
          <Card className="lg:col-span-2 animate-fade-in">
            <CardHeader className="text-center pb-6">
              <CardTitle className="text-2xl flex items-center justify-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                Быстрый обмен
              </CardTitle>
              <CardDescription className="text-base">
                Создайте заявку на обмен валют за несколько кликов
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}>
                <QuickExchange />
              </Suspense>
            </CardContent>
          </Card>

          {/* Exchange Rates - Компактный */}
          <Card className="animate-fade-in">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Курсы валют
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Loader2 className="h-6 w-6 animate-spin" />}>
                <ExchangeRates />
              </Suspense>
            </CardContent>
          </Card>
        </div>

        {/* Преимущества - Компактные */}
        <Card className="animate-fade-in">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 text-center max-w-full overflow-x-hidden">
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-green-500/10 text-green-600 mx-auto w-fit">
                  <Shield className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-sm">100% Безопасность</h3>
                <p className="text-xs text-muted-foreground">Гарантия сделок</p>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 mx-auto w-fit">
                  <Clock className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-sm">5-15 минут</h3>
                <p className="text-xs text-muted-foreground">Время обмена</p>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-purple-500/10 text-purple-600 mx-auto w-fit">
                  <CheckCircle className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-sm">Лучшие курсы</h3>
                <p className="text-xs text-muted-foreground">На рынке</p>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-lg bg-orange-500/10 text-orange-600 mx-auto w-fit">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-sm">Мгновенно</h3>
                <p className="text-xs text-muted-foreground">Создание заявки</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <MobileNav />
    </div>
  );
}

export default function HomePage() {
  return (
    <ClientProvider>
      <HomePageContent />
    </ClientProvider>
  );
}
