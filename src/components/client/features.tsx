"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Zap, Clock, Users, Lock, Globe } from "lucide-react";

const features = [
  {
    icon: Shield,
    title: "Безопасность",
    description: "Все операции защищены современными методами шифрования и двухфакторной аутентификацией",
  },
  {
    icon: Zap,
    title: "Скорость",
    description: "Мгновенные переводы и быстрая обработка заявок в течение нескольких минут",
  },
  {
    icon: Clock,
    title: "24/7",
    description: "Круглосуточная поддержка и обработка заявок в любое время",
  },
  {
    icon: Users,
    title: "Поддержка",
    description: "Профессиональная команда поддержки готова помочь в любое время",
  },
  {
    icon: Lock,
    title: "Конфиденциальность",
    description: "Ваши данные защищены и не передаются третьим лицам",
  },
  {
    icon: Globe,
    title: "Доступность",
    description: "Работаем по всему миру с поддержкой множества валют",
  },
];

export function Features() {
  return (
    <section className="py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold mb-4">Почему выбирают нас</h2>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Мы предоставляем лучший сервис обмена криптовалют с фокусом на безопасность и удобство
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature, index) => (
          <Card key={index} className="text-center hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <feature.icon className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-base">
                {feature.description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
