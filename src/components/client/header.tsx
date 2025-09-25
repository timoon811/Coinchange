"use client";

import { useState } from "react";
import Link from "next/link";
import { useClient } from "@/components/client/client-provider";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Menu, X, User, History, Settings, LogOut, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Header() {
  const { client, logout } = useClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2 px-4 max-w-full overflow-x-hidden">
        <Link href="/client" className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl sm:rounded-2xl gradient-primary shadow-lg">
            <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm sm:text-base font-bold truncate">CryptoExchange</span>
            <span className="text-xs text-muted-foreground font-medium hidden sm:block">Обменный сервис</span>
          </div>
        </Link>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1 sm:gap-2 px-4 ml-auto">
        <ThemeToggle />
        
        {client ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-1 sm:gap-2 h-auto p-1 sm:p-2 min-w-0">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
                  <AvatarFallback className="text-xs sm:text-sm">
                    {client.firstName?.charAt(0) || client.username?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden sm:flex flex-col items-start text-left min-w-0">
                  <span className="text-sm font-medium truncate max-w-24">
                    {client.firstName || client.username || "Пользователь"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Клиент
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/client/profile" className="flex items-center">
                  <User className="mr-2 h-4 w-4" />
                  <span>Профиль</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/client/requests" className="flex items-center">
                  <History className="mr-2 h-4 w-4" />
                  <span>Мои заявки</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/client/settings" className="flex items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Настройки</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Выйти</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild size="sm" className="text-sm px-3 sm:px-4">
            <Link href="/auth">Войти</Link>
          </Button>
        )}

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={toggleMobileMenu}
        >
          {isMobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {/* Mobile Navigation */}
      <div
        className={cn(
          "md:hidden transition-all duration-300 ease-in-out absolute top-16 left-0 right-0 bg-background border-b border-border",
          isMobileMenuOpen
            ? "max-h-96 opacity-100 pb-4"
            : "max-h-0 opacity-0 overflow-hidden"
        )}
      >
        <nav className="flex flex-col space-y-2 pt-4 px-4">
          <Link
            href="/client"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Главная
          </Link>
          <Link
            href="/client/requests"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors py-2"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Мои заявки
          </Link>
        </nav>
      </div>
    </header>
  );
}
