"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface GCOErrorProps {
    message: string;
    details?: string | string[];
    onRetry?: () => void;
    className?: string;
}

export function GCOError({ message, details, onRetry, className }: GCOErrorProps) {
    return (
        <div className={cn(
            "p-6 bg-red-50/50 border border-red-100 rounded-2xl animate-in slide-in-from-top-4 duration-300",
            className
        )}>
            <div className="flex items-start gap-4">
                <div className="bg-red-100 p-2 rounded-xl">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
                <div className="flex-1 space-y-2">
                    <h3 className="font-bold text-red-900 text-lg">{message}</h3>

                    {details && (
                        <div className="text-sm text-red-700/80 bg-white/50 p-3 rounded-lg border border-red-200/50 font-mono">
                            {Array.isArray(details) ? (
                                <ul className="list-disc list-inside space-y-1">
                                    {details.map((d, i) => <li key={i}>{d}</li>)}
                                </ul>
                            ) : (
                                <p>{details}</p>
                            )}
                        </div>
                    )}

                    {onRetry && (
                        <Button
                            onClick={onRetry}
                            variant="outline"
                            className="mt-2 border-red-200 hover:bg-red-100 text-red-700 gap-2"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Reintentar Operación
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
