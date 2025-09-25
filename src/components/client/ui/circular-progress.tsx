"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface CircularProgressProps {
  value: number;
  max?: number;
  size?: "sm" | "md" | "lg";
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  showValue?: boolean;
  label?: string;
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
}

export function CircularProgress({
  value,
  max = 100,
  size = "md",
  strokeWidth,
  className,
  children,
  showValue = true,
  label,
  color = "primary",
}: CircularProgressProps) {
  // Безопасная проверка значений
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeMax = typeof max === 'number' && !isNaN(max) && max > 0 ? max : 100;
  const percentage = Math.max(0, Math.min(100, (safeValue / safeMax) * 100));
  
  const sizeConfig = {
    sm: { 
      width: 80, 
      height: 80, 
      defaultStroke: 6,
      textSize: "text-sm",
      labelSize: "text-xs"
    },
    md: { 
      width: 120, 
      height: 120, 
      defaultStroke: 8,
      textSize: "text-lg",
      labelSize: "text-sm"
    },
    lg: { 
      width: 160, 
      height: 160, 
      defaultStroke: 10,
      textSize: "text-2xl",
      labelSize: "text-base"
    },
  };

  const config = sizeConfig[size];
  const stroke = strokeWidth || config.defaultStroke;
  const radius = (config.width - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Безопасное вычисление strokeDashoffset
  const safePercentage = isNaN(percentage) ? 0 : percentage;
  const strokeDashoffset = circumference - (safePercentage / 100) * circumference;

  const colorClasses = {
    primary: "stroke-primary",
    secondary: "stroke-secondary",
    success: "stroke-green-500",
    warning: "stroke-yellow-500",
    danger: "stroke-red-500",
  };

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div className="relative">
        <svg
          width={config.width}
          height={config.height}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted opacity-20"
          />
          
          {/* Progress circle */}
          <circle
            cx={config.width / 2}
            cy={config.height / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(colorClasses[color], "transition-all duration-1000 ease-out")}
            style={{
              filter: "drop-shadow(0 2px 4px rgba(59, 130, 246, 0.3))",
            }}
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children || (
            showValue && (
              <div className="text-center">
                <div className={cn("font-bold text-foreground", config.textSize)}>
                  {Math.round(percentage)}%
                </div>
                {label && (
                  <div className={cn("text-muted-foreground", config.labelSize)}>
                    {label}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
