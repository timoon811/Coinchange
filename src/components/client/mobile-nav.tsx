"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ArrowUpDown, BarChart3, User, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/components/client/client-provider";

const navItems = [
  {
    href: "/client",
    icon: Home,
    label: "Главная",
    requireAuth: false,
  },
  {
    href: "/client/requests",
    icon: History,
    label: "Заявки",
    requireAuth: true,
  },
  {
    href: "/client/profile",
    icon: User,
    label: "Профиль",
    requireAuth: true,
  },
];

export function MobileNav() {
  const pathname = usePathname();
  const { client } = useClient();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-md border-t border-border/30 md:hidden z-50 safe-area-inset-bottom shadow-2xl">
      <div className="flex items-center justify-around py-3 px-6 max-w-full overflow-x-hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isDisabled = item.requireAuth && !client;
          
          return (
            <Link
              key={item.href}
              href={isDisabled ? "/client/auth" : item.href}
              className={cn(
                "flex flex-col items-center space-y-2 px-4 py-3 rounded-2xl transition-all duration-300 min-w-0 flex-1 group",
                isActive
                  ? "text-primary bg-primary/10 scale-110 shadow-lg"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:scale-105",
                isDisabled && "opacity-50"
              )}
            >
              <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-primary text-white shadow-lg"
                  : "group-hover:bg-primary/10"
              )}>
                <item.icon className="h-5 w-5 flex-shrink-0" />
              </div>
              <span className={cn(
                "text-xs font-semibold truncate transition-colors duration-300",
                isActive ? "text-primary" : ""
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
