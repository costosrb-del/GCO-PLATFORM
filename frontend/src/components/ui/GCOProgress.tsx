"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GCOProgressProps {
    progress: number;
    message: string;
    submessage?: string;
    className?: string;
}

export function GCOProgress({ progress, message, submessage, className }: GCOProgressProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-8 bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-100 shadow-xl animate-in fade-in zoom-in duration-300",
            className
        )}>
            <div className="relative mb-6">
                <div className="absolute inset-0 bg-[#183C30]/10 rounded-full blur-2xl animate-pulse" />
                <div className="relative bg-white rounded-full p-4 shadow-inner">
                    <Loader2 className="h-8 w-8 text-[#183C30] animate-spin" />
                </div>
            </div>

            <div className="text-center space-y-2 mb-6">
                <h3 className="text-lg font-bold text-gray-900">{message}</h3>
                {submessage && <p className="text-sm text-gray-500">{submessage}</p>}
            </div>

            <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <span>Progreso</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200/50 p-0.5">
                    <div
                        className="h-full bg-gradient-to-r from-[#183C30] to-[#2d6a56] rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(24,60,48,0.3)]"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}
