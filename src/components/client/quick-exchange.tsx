"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowUpDown, Calculator, Zap } from "lucide-react";
import { useClient } from "@/components/client/client-provider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Currency {
  code: string;
  name: string;
  symbol?: string;
  type: "CRYPTO" | "FIAT" | "CASH";
}

interface ExchangeRate {
  currency: Currency;
  purchaseRate: number;
  sellRate: number;
}

export function QuickExchange() {
  const { client } = useClient();
  const router = useRouter();
  
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Форма обмена
  const [fromCurrency, setFromCurrency] = useState<string>("");
  const [toCurrency, setToCurrency] = useState<string>("");
  const [fromAmount, setFromAmount] = useState<string>("");
  const [toAmount, setToAmount] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isCalculating, setIsCalculating] = useState(false);

  // Загружаем валюты и курсы
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        const [currenciesRes, ratesRes] = await Promise.all([
          fetch("/api/currencies"),
          fetch("/api/exchange-rates")
        ]);

        if (currenciesRes.ok) {
          const currenciesData = await currenciesRes.json();
          setCurrencies(currenciesData.data || []);
        }

        if (ratesRes.ok) {
          const ratesData = await ratesRes.json();
          setRates(ratesData.data || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Ошибка загрузки данных");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Вычисляем курс обмена
  const calculateExchange = () => {
    if (!fromCurrency || !toCurrency || !fromAmount) return;

    const fromRate = rates.find(r => r.currency.code === fromCurrency);
    const toRate = rates.find(r => r.currency.code === toCurrency);

    if (!fromRate || !toRate) return;

    const amount = parseFloat(fromAmount);
    if (isNaN(amount) || amount <= 0) return;

    // Простая логика: используем курс продажи для криптовалюты и курс покупки для фиата
    let result = 0;
    if (fromRate.currency.type === "CRYPTO" && toRate.currency.type === "FIAT") {
      result = amount * fromRate.sellRate;
    } else if (fromRate.currency.type === "FIAT" && toRate.currency.type === "CRYPTO") {
      result = amount / toRate.purchaseRate;
    } else {
      // Крипто в крипто через фиат
      const fiatAmount = amount * fromRate.sellRate;
      result = fiatAmount / toRate.purchaseRate;
    }

    setToAmount(result.toFixed(8));
  };

  // Автоматический пересчет при изменении
  useEffect(() => {
    if (fromCurrency && toCurrency && fromAmount) {
      setIsCalculating(true);
      const timer = setTimeout(() => {
        calculateExchange();
        setIsCalculating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [fromCurrency, toCurrency, fromAmount]);

  const handleSwap = () => {
    const tempCurrency = fromCurrency;
    const tempAmount = fromAmount;
    
    setFromCurrency(toCurrency);
    setToCurrency(tempCurrency);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!client) {
      toast.error("Необходимо войти в систему");
      router.push("/client/auth");
      return;
    }

    if (!fromCurrency || !toCurrency || !fromAmount || !toAmount) {
      toast.error("Заполните все поля");
      return;
    }

    if (fromCurrency !== "RUB" && !walletAddress) {
      toast.error("Укажите адрес кошелька");
      return;
    }

    // Простая валидация адреса кошелька
    if (fromCurrency !== "RUB" && walletAddress && walletAddress.length < 10) {
      toast.error("Неверный формат адреса кошелька");
      return;
    }

    try {
      setIsLoading(true);
      
      const response = await fetch("/api/client/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          direction: fromCurrency === "RUB" ? "CASH_TO_CRYPTO" : "CRYPTO_TO_CASH",
          fromCurrency,
          toCurrency,
          fromAmount: parseFloat(fromAmount),
          toAmount: parseFloat(toAmount),
          walletAddress: fromCurrency !== "RUB" ? walletAddress : undefined,
          clientId: client?.id,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create request");
      }

      const data = await response.json();
      toast.success("Заявка создана успешно!");
      router.push(`/client/requests`);
    } catch (error) {
      console.error("Error creating request:", error);
      toast.error("Ошибка создания заявки");
    } finally {
      setIsLoading(false);
    }
  };

  const cryptoCurrencies = currencies.filter(c => c.type === "CRYPTO");
  const fiatCurrencies = currencies.filter(c => c.type === "FIAT");

  return (
    <div className="space-y-4 w-full overflow-x-hidden">
      <form onSubmit={handleSubmit} className="space-y-4 w-full overflow-x-hidden">
        {/* Отдаете - Адаптивный дизайн */}
        <div className="space-y-2 w-full">
          <Label htmlFor="from-currency" className="text-sm font-medium">Отдаете</Label>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Select value={fromCurrency} onValueChange={setFromCurrency}>
              <SelectTrigger className="w-full sm:flex-1 h-12 min-w-0">
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RUB">🇷🇺 RUB - Российский рубль</SelectItem>
                {cryptoCurrencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="from-amount"
              type="number"
              placeholder="0.00"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="w-full sm:w-32 lg:w-40 h-12 text-base sm:text-lg font-semibold"
              step="0.00000001"
              min="0"
            />
          </div>
        </div>

        {/* Кнопка обмена - Адаптивная */}
        <div className="flex justify-center py-2">
          <Button
            type="button"
            variant="glass"
            size="icon"
            onClick={handleSwap}
            className="rounded-full h-12 w-12 sm:h-14 sm:w-14 border-2 hover:border-primary shadow-xl hover:shadow-2xl hover:scale-110 transition-all duration-300"
          >
            <ArrowUpDown className="h-5 w-5 sm:h-6 sm:w-6" />
          </Button>
        </div>

        {/* Получаете - Адаптивный дизайн */}
        <div className="space-y-2 w-full">
          <Label htmlFor="to-currency" className="text-sm font-medium">Получаете</Label>
          <div className="flex flex-col sm:flex-row gap-2 w-full">
            <Select value={toCurrency} onValueChange={setToCurrency}>
              <SelectTrigger className="w-full sm:flex-1 h-12 min-w-0">
                <SelectValue placeholder="Выберите валюту" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RUB">🇷🇺 RUB - Российский рубль</SelectItem>
                {cryptoCurrencies.map((currency) => (
                  <SelectItem key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.code} - {currency.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              id="to-amount"
              type="number"
              placeholder="0.00"
              value={toAmount}
              readOnly
              className="w-full sm:w-32 lg:w-40 h-12 text-base sm:text-lg font-semibold bg-muted"
              step="0.00000001"
            />
          </div>
        </div>

        {/* Адрес кошелька - Адаптивный */}
        {fromCurrency && fromCurrency !== "RUB" && (
          <div className="space-y-2 w-full">
            <Label htmlFor="wallet-address" className="text-sm font-medium">
              Адрес кошелька {fromCurrency}
            </Label>
            <Input
              id="wallet-address"
              placeholder={`Введите адрес кошелька ${fromCurrency}`}
              value={walletAddress}
              onChange={(e) => setWalletAddress(e.target.value)}
              className="h-12 w-full text-sm sm:text-base"
            />
          </div>
        )}

        {/* Индикатор расчета - Адаптивный */}
        {isCalculating && (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-3">
            <Calculator className="h-4 w-4 animate-spin" />
            <span>Расчет курса...</span>
          </div>
        )}

        {/* Кнопка отправки - Адаптивная */}
        <Button
          type="submit"
          variant="crypto"
          size="lg"
          className="w-full text-base sm:text-lg font-bold shadow-2xl hover:shadow-primary/25 h-12 sm:h-14 mobile-button"
          disabled={isLoading || isCalculating || !fromCurrency || !toCurrency || !fromAmount}
        >
          {isLoading ? "Создание заявки..." : "Создать заявку"}
        </Button>
      </form>
    </div>
  );
}
