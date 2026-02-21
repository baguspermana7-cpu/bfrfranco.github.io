
import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-block ml-1"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <Info className="w-3 h-3 text-slate-500 hover:text-cyan-400 cursor-help" />
            {isVisible && (
                <div className="absolute z-50 w-64 p-2 mt-2 -ml-32 text-xs text-white bg-slate-800 rounded-lg shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                    {content}
                    <div className="absolute w-2 h-2 bg-slate-800 transform rotate-45 -top-1 left-1/2 -ml-1 border-t border-l border-slate-700" />
                </div>
            )}
        </div>
    );
};
