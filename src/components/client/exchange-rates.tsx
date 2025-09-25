"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CircularProgress } from "@/components/client/ui/circular-progress";
import { Loader2 } from "lucide-react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn, formatCrypto, getCurrencyColor, getCurrencyIcon } from "@/lib/utils";

interface ExchangeRate {
  id: string;
  currency: {
    code: string;
    name: string;
    symbol?: string;
  };
  purchaseRate: number;
  sellRate: number;
  rateDate: string;
}

export function ExchangeRates() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setIsLoading(true);
        const response = await fetch("/api/exchange-rates");
        
        if (!response.ok) {
          throw new Error("Failed to fetch exchange rates");
        }

        const data = await response.json();
        setRates(data.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRates();
    
    // Обновляем курсы каждые 30 секунд
    const interval = setInterval(fetchRates, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return <Loader2 className="h-6 w-6 animate-spin" />;
  }

  if (error) {
    return (
      <div className="text-center text-red-500 py-8">
        <p>Ошибка загрузки курсов: {error}</p>
      </div>
    );
  }

  if (rates.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p>Курсы валют временно недоступны</p>
      </div>
    );
  }

  // Имитируем процентное изменение для демонстрации круговых индикаторов
  const getRateChangePercentage = (rate: ExchangeRate) => {
    // Простая логика для демонстрации
    const avg = (rate.purchaseRate + rate.sellRate) / 2;
    return Math.min(100, Math.max(0, (avg / 100) * 10)); // Нормализованное значение для демонстрации
  };

  return (
    <div className="space-y-3 w-full">
      {rates.map((rate) => {
        const changePercentage = getRateChangePercentage(rate);
        return (
          <Card key={rate.id} className="group hover:scale-[1.01] transition-all duration-300 border-border/30 w-full overflow-hidden">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center space-x-2 sm:space-x-4 flex-1 min-w-0">
                  {/* Круговой индикатор - скрытый на мобильных */}
                  <div className="hidden sm:flex flex-shrink-0">
                    <CircularProgress
                      value={changePercentage}
                      size="sm"
                      color="primary"
                      showValue={true}
                      label="курс"
                    />
                  </div>
                  
                  <div className="flex flex-col flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-bold truncate">
                      {rate.currency.symbol} {rate.currency.code}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {rate.currency.name}
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-2 text-xs text-muted-foreground mt-1">
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <TrendingUp className="h-3 w-3 text-green-500" />
                        {formatCrypto(rate.purchaseRate, 2)} ₽
                      </span>
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <TrendingDown className="h-3 w-3 text-red-500" />
                        {formatCrypto(rate.sellRate, 2)} ₽
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col items-end space-y-1 flex-shrink-0">
                  <Badge variant="secondary" className="text-xs bg-primary/10 text-primary border-primary/20 px-2 py-1">
                    Актуально
                  </Badge>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {new Date(rate.rateDate).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
