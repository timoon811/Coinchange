import { Suspense } from "react";
import { ExchangeRates } from "@/components/client/exchange-rates";
import { QuickExchange } from "@/components/client/quick-exchange";
import { Header } from "@/components/client/header";
import { MobileNav } from "@/components/client/mobile-nav";
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

export default function HomePage() {
  return (
    <div className="min-h-screen gradient-background overflow-x-hidden w-full">
      <Header />
      
      <main className="flex-1 w-full max-w-7xl mx-auto responsive-container pb-44 md:pb-8">
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Hero Section - Адаптивный */}
          <div className="text-center space-y-4 sm:space-y-6 animate-fade-in responsive-padding">
            <div className="flex justify-center">
              <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 backdrop-blur-sm border border-primary/20 shadow-2xl">
                <ArrowUpDown className="h-12 w-12 sm:h-16 sm:w-16 text-primary drop-shadow-lg" />
              </div>
            </div>
            <div className="space-y-2 sm:space-y-3">
              <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent px-2">
                Обмен криптовалют
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto font-medium px-4">
                Быстрый, безопасный и выгодный обмен с лучшими курсами
              </p>
            </div>
          </div>

          {/* Основной контент - Адаптивный */}
          <div className="grid gap-4 sm:gap-6 lg:gap-8 lg:grid-cols-3">
            {/* Quick Exchange - Главный блок адаптивный */}
            <Card className="lg:col-span-2 animate-fade-in card-glass border-primary/20 mobile-card">
              <CardHeader className="text-center pb-4 sm:pb-8 px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl lg:text-3xl font-bold flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3">
                  <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl gradient-primary">
                    <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <span className="text-center sm:text-left">Быстрый обмен</span>
                </CardTitle>
                <CardDescription className="text-sm sm:text-base lg:text-lg font-medium text-muted-foreground px-2">
                  Создайте заявку на обмен валют за несколько кликов
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8">
                <Suspense fallback={
                  <div className="flex items-center justify-center py-8 sm:py-12">
                    <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                  </div>
                }>
                  <QuickExchange />
                </Suspense>
              </CardContent>
            </Card>

            {/* Exchange Rates - Адаптивный */}
            <Card className="animate-fade-in card-glass border-secondary/20 mobile-card">
              <CardHeader className="pb-4 sm:pb-6 px-4 sm:px-6">
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl gradient-secondary">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                  </div>
                  <span>Курсы валют</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <Suspense fallback={
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin text-primary" />
                  </div>
                }>
                  <ExchangeRates />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          {/* Преимущества - Адаптивные */}
          <Card className="animate-fade-in card-glass mobile-card">
            <CardContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 px-4 sm:px-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 text-center w-full">
                <div className="space-y-3 sm:space-y-4 group hover:scale-105 transition-transform duration-300">
                  <div className="relative">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl gradient-secondary mx-auto w-fit shadow-lg">
                      <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <div className="absolute -inset-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-green-500/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  </div>
                  <div className="space-y-1 px-1">
                    <h3 className="font-bold text-sm sm:text-base">100% Безопасность</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Гарантия сделок</p>
                  </div>
                </div>
                
                <div className="space-y-3 sm:space-y-4 group hover:scale-105 transition-transform duration-300">
                  <div className="relative">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl gradient-primary mx-auto w-fit shadow-lg">
                      <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <div className="absolute -inset-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  </div>
                  <div className="space-y-1 px-1">
                    <h3 className="font-bold text-sm sm:text-base">5-15 минут</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Время обмена</p>
                  </div>
                </div>
                
                <div className="space-y-3 sm:space-y-4 group hover:scale-105 transition-transform duration-300">
                  <div className="relative">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl gradient-purple mx-auto w-fit shadow-lg">
                      <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <div className="absolute -inset-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-purple-500/20 to-violet-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  </div>
                  <div className="space-y-1 px-1">
                    <h3 className="font-bold text-sm sm:text-base">Лучшие курсы</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">На рынке</p>
                  </div>
                </div>
                
                <div className="space-y-3 sm:space-y-4 group hover:scale-105 transition-transform duration-300">
                  <div className="relative">
                    <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl gradient-accent mx-auto w-fit shadow-lg">
                      <Zap className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    </div>
                    <div className="absolute -inset-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-orange-500/20 to-yellow-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-sm"></div>
                  </div>
                  <div className="space-y-1 px-1">
                    <h3 className="font-bold text-sm sm:text-base">Мгновенно</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground font-medium">Создание заявки</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <MobileNav />
    </div>
  );
}
