"use client"

import * as React from "react"
import { Check, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
  title: string
  description?: string
}

interface StepperProps {
  steps: Step[]
  currentStep: number
  completedSteps?: number[]
  className?: string
}

export function Stepper({ steps, currentStep, completedSteps = [], className }: StepperProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Мобильная версия - вертикальная */}
      <div className="block md:hidden">
        <div className="space-y-4">
          {steps.map((step, index) => {
            const isCompleted = completedSteps.includes(index) || index < currentStep
            const isCurrent = index === currentStep
            const isPending = index > currentStep

            return (
              <div key={index} className="flex items-start space-x-4">
                {/* Step Indicator */}
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                      {
                        "bg-green-500 border-green-500 text-white": isCompleted,
                        "bg-blue-500 border-blue-500 text-white": isCurrent,
                        "border-gray-300 text-gray-500": isPending,
                      }
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4" />
                    ) : isCurrent ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  {/* Vertical Line */}
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        "w-0.5 h-12 mt-2 transition-colors",
                        {
                          "bg-green-500": index < currentStep,
                          "bg-gray-200": index >= currentStep,
                        }
                      )}
                    />
                  )}
                </div>

                {/* Step Content */}
                <div className="flex-1 pt-1">
                  <div
                    className={cn("text-sm font-medium", {
                      "text-green-600": isCompleted,
                      "text-blue-600": isCurrent,
                      "text-gray-500": isPending,
                    })}
                  >
                    {step.title}
                  </div>
                  {step.description && (
                    <div className="text-sm text-muted-foreground mt-1">
                      {step.description}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Десктопная версия - горизонтальная улучшенная */}
      <div className="hidden md:block">
        <div className="relative">
          {/* Прогресс линия на фоне */}
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
            <div 
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />
          </div>

          {/* Шаги */}
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(index) || index < currentStep
              const isCurrent = index === currentStep
              const isPending = index > currentStep

              return (
                <div key={index} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
                  {/* Step Circle */}
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-all duration-300 bg-white relative z-10",
                      {
                        "border-green-500 text-green-500": isCompleted,
                        "border-blue-500 text-blue-500 ring-4 ring-blue-100": isCurrent,
                        "border-gray-300 text-gray-500": isPending,
                      }
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : isCurrent ? (
                      <Clock className="h-4 w-4 text-blue-500" />
                    ) : (
                      <span className="text-gray-500">{index + 1}</span>
                    )}
                  </div>

                  {/* Step Content */}
                  <div className="mt-3 text-center px-2">
                    <div
                      className={cn("text-sm font-medium leading-tight", {
                        "text-green-600": isCompleted,
                        "text-blue-600": isCurrent,
                        "text-gray-500": isPending,
                      })}
                    >
                      {step.title}
                    </div>
                    {step.description && (
                      <div className="text-xs text-muted-foreground mt-1 leading-tight max-w-28 mx-auto">
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

interface StepperVerticalProps {
  steps: Step[]
  currentStep: number
  completedSteps?: number[]
  className?: string
}

export function StepperVertical({ steps, currentStep, completedSteps = [], className }: StepperVerticalProps) {
  return (
    <div className={cn("w-full", className)}>
      <div className="space-y-4">
        {steps.map((step, index) => {
          const isCompleted = completedSteps.includes(index) || index < currentStep
          const isCurrent = index === currentStep
          const isPending = index > currentStep

          return (
            <div key={index} className="flex items-start space-x-4">
              {/* Step Indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-medium transition-colors",
                    {
                      "bg-green-500 border-green-500 text-white": isCompleted,
                      "bg-blue-500 border-blue-500 text-white": isCurrent,
                      "border-gray-300 text-gray-500": isPending,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : isCurrent ? (
                    <Clock className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>

                {/* Vertical Line */}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 h-16 mt-2 transition-colors",
                      {
                        "bg-green-500": index < currentStep,
                        "bg-gray-200": index >= currentStep,
                      }
                    )}
                  />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pt-1">
                <div
                  className={cn("text-sm font-medium", {
                    "text-green-600": isCompleted,
                    "text-blue-600": isCurrent,
                    "text-gray-500": isPending,
                  })}
                >
                  {step.title}
                </div>
                {step.description && (
                  <div className="text-sm text-gray-600 mt-1">
                    {step.description}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
