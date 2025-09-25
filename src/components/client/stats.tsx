"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, Users, DollarSign, Clock } from "lucide-react";
import { formatCrypto } from "@/lib/utils";

interface StatsData {
  totalVolume: number;
  totalRequests: number;
  averageTime: number;
  activeUsers: number;
}

export function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch("/api/dashboard/stats");
        if (response.ok) {
          const data = await response.json();
          setStats(data.data);
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader className="pb-2">
              <div className="h-4 bg-muted rounded w-3/4"></div>
            </CardHeader>
            <CardContent>
              <div className="h-8 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const statsItems = [
    {
      title: "Общий объем",
      value: stats ? formatCrypto(stats.totalVolume, 2) + " ₽" : "0 ₽",
      icon: DollarSign,
      description: "За все время",
    },
    {
      title: "Заявок обработано",
      value: stats?.totalRequests?.toString() || "0",
      icon: TrendingUp,
      description: "Успешно завершено",
    },
    {
      title: "Среднее время",
      value: stats ? `${stats.averageTime} мин` : "0 мин",
      icon: Clock,
      description: "Обработки заявки",
    },
    {
      title: "Активных пользователей",
      value: stats?.activeUsers?.toString() || "0",
      icon: Users,
      description: "Сейчас онлайн",
    },
  ];

  return (
    <section className="py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsItems.map((item, index) => (
          <Card key={index} className="text-center">
            <CardHeader className="pb-2">
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <item.icon className="h-4 w-4" />
              </div>
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{item.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {item.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
