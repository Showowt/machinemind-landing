"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md px-6">
        {/* Error icon */}
        <div className="w-16 h-16 mx-auto mb-6 border border-[var(--mm-down)] flex items-center justify-center">
          <svg
            className="w-8 h-8 text-[var(--mm-down)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <h2 className="font-heading text-2xl font-bold text-white mb-4">
          Error del Sistema
        </h2>
        <p className="text-muted mb-8">
          Ha ocurrido un error inesperado. Por favor intenta de nuevo.
        </p>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button onClick={reset} variant="gold">
            Reintentar
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Volver al Inicio
          </Button>
        </div>

        {/* Error digest for debugging */}
        {error.digest && (
          <p className="text-xs text-muted mt-8">Error ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
