'use client';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <nav aria-label="Onboarding progress" className="w-full">
      <ol className="flex items-center justify-center gap-2 sm:gap-0">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;
          const isLast = i === totalSteps - 1;

          return (
            <li key={stepNum} className="flex items-center">
              {/* Step circle + label */}
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-all duration-300 ${
                    isCompleted
                      ? 'bg-primary text-primary-foreground'
                      : isActive
                      ? 'bg-primary text-primary-foreground ring-4 ring-primary/20 scale-110'
                      : 'bg-muted text-muted-foreground'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium transition-colors duration-300 ${
                    isActive
                      ? 'text-foreground'
                      : isCompleted
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                  }`}
                >
                  {labels[i] || `Step ${stepNum}`}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={`hidden sm:block mx-3 h-0.5 w-12 sm:w-20 rounded transition-colors duration-500 ${
                    isCompleted ? 'bg-primary' : 'bg-muted'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
