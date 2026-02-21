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
            className={clsx(
                "flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-cyan-900/20 transition-all disabled:opacity-50",
                className
            )}
        >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? "Generating..." : label}
        </button>
    );
}
