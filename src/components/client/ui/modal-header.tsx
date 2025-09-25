"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { X, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  onClose?: () => void;
  onBack?: () => void;
  showClose?: boolean;
  showBack?: boolean;
  icon?: React.ReactNode;
}

export function ModalHeader({
  title,
  description,
  onClose,
  onBack,
  showClose = true,
  showBack = false,
  icon,
  className,
  ...props
}: ModalHeaderProps) {
  return (
    <div 
      className={cn("relative px-4 sm:px-6 pt-6 pb-4", className)}
      {...props}
    >
      {/* Кнопка назад */}
      {showBack && onBack && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="absolute top-4 left-4 h-8 w-8 rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      )}
      
      {/* Кнопка закрытия */}
      {showClose && onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-full"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
      
      {/* Контент заголовка */}
      <div className={cn(
        "text-center",
        (showBack || showClose) && "pt-6"
      )}>
        {icon && (
          <div className="flex justify-center mb-4">
            <div className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl gradient-primary shadow-lg">
              {icon}
            </div>
          </div>
        )}
        
        <h2 className="text-xl sm:text-2xl font-bold mb-2">
          {title}
        </h2>
        
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
