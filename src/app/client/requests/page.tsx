"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useClient } from "@/components/client/client-provider";
import { toast } from "sonner";
import { 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Eye,
  ArrowUpDown
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MobileNav } from "@/components/client/mobile-nav";

interface Request {
  id: string;
  requestId: string;
  direction: string;
  status: string;
  createdAt: string;
  finance: {
    fromCurrency: string;
    toCurrency: string;
    expectedAmountFrom: number;
    expectedAmountTo: number;
  };
  office: {
    name: string;
  };
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

export default function RequestsPage() {
  const { client } = useClient();
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!client) {
      router.push("/client");
      return;
    }

    fetchRequests();
  }, [client, router]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/client/requests?clientId=${client?.id}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch requests");
      }

      const data = await response.json();
      setRequests(data.data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
      toast.error("Ошибка загрузки заявок");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Загрузка заявок...</p>
        </div>
      </div>
    );
  }

  if (!client) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen gradient-background overflow-x-hidden w-full">
      <div className="w-full max-w-6xl mx-auto responsive-container pb-44 md:pb-8">
        <div className="space-y-4 sm:space-y-6 responsive-padding">
          {/* Заголовок - Адаптивный */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="w-full sm:w-auto">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Мои заявки</h1>
              <p className="text-sm sm:text-base text-muted-foreground">История всех ваших операций</p>
            </div>
            <Button 
              onClick={() => router.push("/client")}
              variant="crypto"
              size="sm"
              className="w-full sm:w-auto mobile-button"
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Создать заявку
            </Button>
          </div>

          {/* Список заявок - Адаптивный */}
          {requests.length === 0 ? (
            <Card className="card-glass mobile-card">
              <CardContent className="text-center py-8 sm:py-12 px-4 sm:px-6">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-base sm:text-lg font-semibold mb-2">У вас пока нет заявок</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Создайте первую заявку на обмен валют
                </p>
                <Button 
                  onClick={() => router.push("/client")}
                  variant="crypto"
                  className="mobile-button"
                >
                  Создать заявку
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3 sm:space-y-4 w-full">
              {requests.map((request) => {
                const statusInfo = statusConfig[request.status as keyof typeof statusConfig] || statusConfig.NEW;
                const StatusIcon = statusInfo.icon;

                return (
                  <Card key={request.id} className="card-glass mobile-card hover:scale-[1.01] transition-all duration-300">
                    <CardContent className="p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                            <h3 className="font-semibold text-sm sm:text-base truncate">Заявка #{request.requestId}</h3>
                            <Badge className={`${statusInfo.color} text-xs whitespace-nowrap`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-xs sm:text-sm text-muted-foreground">
                            {directionLabels[request.direction as keyof typeof directionLabels] || request.direction}
                          </p>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground">
                            <span className="truncate">
                              {formatCurrency(request.finance.expectedAmountFrom)} {request.finance.fromCurrency}
                            </span>
                            <span className="hidden sm:inline">→</span>
                            <span className="truncate">
                              {formatCurrency(request.finance.expectedAmountTo || 0)} {request.finance.toCurrency}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {request.office?.name} • {format(new Date(request.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full sm:w-auto text-xs sm:text-sm"
                            onClick={() => router.push(`/client/requests/${request.id}`)}
                          >
                            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                            Подробнее
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}