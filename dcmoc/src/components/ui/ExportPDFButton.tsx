import React from 'react';
import { Download, Loader2 } from 'lucide-react';
import clsx from 'clsx';

export interface ExportPDFButtonProps {
    onExport: () => Promise<void>;
    isGenerating: boolean;
    label?: string;
    className?: string;
}

export function ExportPDFButton({ onExport, isGenerating, label = "Export PDF", className }: ExportPDFButtonProps) {
    return (
        <button
            onClick={onExport}
            disabled={isGenerating}
            aria-label={isGenerating ? 'Generating PDF, please wait' : label}
            aria-busy={isGenerating}
            className={clsx(
                "flex items-center gap-2 px-4 py-2 bg-rz-signal hover:bg-rz-signal/90 text-black rounded-lg text-sm font-medium transition-colors disabled:opacity-50",
                className
            )}
        >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? "Generating..." : label}
        </button>
    );
}
