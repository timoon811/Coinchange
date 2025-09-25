"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClient } from "@/components/client/client-provider";
import { toast } from "sonner";
import { 
  ArrowLeft,
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  ArrowUpDown,
  Copy,
  User,
  Building,
  Calendar,
  DollarSign,
  Wallet
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MobileNav } from "@/components/client/mobile-nav";

interface RequestDetail {
  id: string;
  requestId: string;
  direction: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  finance: {
    fromCurrency: string;
    toCurrency: string;
    expectedAmountFrom: number;
    expectedAmountTo: number;
    finalAmountFrom?: number;
    finalAmountTo?: number;
    exchangeRate?: number;
    commission?: number;
  };
  office: {
    name: string;
    address?: string;
  };
  client: {
    firstName?: string;
    lastName?: string;
    username?: string;
    totalRequests: number;
    totalVolume: number;
  };
  walletAddress?: string;
  notes?: string;
}

const statusConfig = {
  NEW: {
    label: 'Новая',
    color: 'bg-blue-100 text-blue-800',
    icon: Clock,
  },
  ASSIGNED: {
    label: 'Назначена',
    color: 'bg-yellow-100 text-yellow-800',
    icon: Clock,
  },
  IN_PROGRESS: {
    label: 'В работе',
    color: 'bg-orange-100 text-orange-800',
    icon: ArrowUpDown,
  },
  COMPLETED: {
    label: 'Завершена',
    color: 'bg-green-100 text-green-800',
    icon: CheckCircle,
  },
  CANCELED: {
    label: 'Отменена',
    color: 'bg-gray-100 text-gray-800',
    icon: XCircle,
  },
  REJECTED: {
    label: 'Отклонена',
    color: 'bg-red-100 text-red-800',
    icon: AlertTriangle,
  },
};

const directionLabels = {
  CRYPTO_TO_CASH: 'Крипта → Наличные',
  CASH_TO_CRYPTO: 'Наличные → Крипта',
  CARD_TO_CRYPTO: 'Карта → Крипта',
  CRYPTO_TO_CARD: 'Крипта → Карта',
  CARD_TO_CASH: 'Карта → Наличные',
  CASH_TO_CARD: 'Наличные → Карта',
};

export default function RequestDetailPage() {
  const { client } = useClient();
  const router = useRouter();
  const params = useParams();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      router.push("/client");
      return;
    }

    if (params.id) {
      fetchRequestDetail(params.id as string);
    }
  }, [client, router, params.id]);

  const fetchRequestDetail = async (requestId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/requests/${requestId}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch request detail");
      }

      const data = await response.json();
      setRequest(data);
    } catch (error) {
      console.error("Error fetching request detail:", error);
      toast.error("Ошибка загрузки заявки");
      router.push("/client/requests");
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    }).format(amount);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Скопировано в буфер обмена");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen gradient-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка заявки...</p>
        </div>
      </div>
    );
  }

  if (!client || !request) {
    return null;
  }

  const statusInfo = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.NEW;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen gradient-background overflow-x-hidden w-full">
      <div className="w-full max-w-4xl mx-auto responsive-container pb-44 md:pb-8">
        <div className="space-y-4 sm:space-y-6 responsive-padding">
          {/* Кнопка назад */}
          <Button 
            variant="outline" 
            onClick={() => router.push("/client/requests")}
            className="w-full sm:w-auto mobile-button"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад к заявкам
          </Button>

          {/* Заголовок */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Заявка #{request.requestId}</h1>
                <Badge className={`${statusInfo.color} text-sm whitespace-nowrap w-fit`}>
                  <StatusIcon className="h-4 w-4 mr-1" />
                  {statusInfo.label}
                </Badge>
              </div>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                {directionLabels[request.direction as keyof typeof directionLabels] || request.direction}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {/* Информация об обмене */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <ArrowUpDown className="h-5 w-5" />
                  Детали обмена
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Отдаете:</span>
                    <span className="font-semibold">
                      {formatCurrency(request.finance.expectedAmountFrom)} {request.finance.fromCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Получаете:</span>
                    <span className="font-semibold">
                      {formatCurrency(request.finance.expectedAmountTo)} {request.finance.toCurrency}
                    </span>
                  </div>
                  {request.finance.exchangeRate && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Курс обмена:</span>
                      <span className="font-semibold">
                        {formatCurrency(request.finance.exchangeRate)}
                      </span>
                    </div>
                  )}
                  {request.finance.commission && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Комиссия:</span>
                      <span className="font-semibold">
                        {formatCurrency(request.finance.commission)} ₽
                      </span>
                    </div>
                  )}
                  {request.walletAddress && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">Адрес кошелька:</span>
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <span className="font-mono text-sm break-all flex-1">
                          {request.walletAddress}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(request.walletAddress!)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Информация о клиенте и офисе */}
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Building className="h-5 w-5" />
                  Детали заявки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 sm:px-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Офис:</span>
                    <span className="font-semibold text-right">{request.office.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Создана:</span>
                    <span className="font-semibold text-right">
                      {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Обновлена:</span>
                    <span className="font-semibold text-right">
                      {format(new Date(request.updatedAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Ваши заявки:</span>
                    <span className="font-semibold">{request.client.totalRequests}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Общий объем:</span>
                    <span className="font-semibold">
                      {formatCurrency(request.client.totalVolume)} ₽
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Примечания */}
          {request.notes && (
            <Card className="card-glass mobile-card">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <FileText className="h-5 w-5" />
                  Примечания
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <p className="text-sm sm:text-base">{request.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
