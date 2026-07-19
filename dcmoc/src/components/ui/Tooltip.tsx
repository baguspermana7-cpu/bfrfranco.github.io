
import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface TooltipProps {
    content: string;
}

/* Portal-rendered, viewport-fixed panel: escapes overflow clipping (e.g. the
 * sidebar nav scroll container) and flips horizontally/vertically to stay
 * inside the viewport. Position computed once per open from the trigger rect. */
interface TooltipPos {
    left: number;
    top?: number;
    bottom?: number;
}

const PANEL_W = 256;   // w-64
const EDGE_PAD = 16;   // viewport safety margin
const GAP = 6;         // trigger → panel gap
const FLIP_UP_ZONE = 240; // if trigger is within this of the bottom, open upward

export const Tooltip: React.FC<TooltipProps> = ({ content }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [pos, setPos] = useState<TooltipPos | null>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    const open = () => {
        const el = triggerRef.current;
        if (!el || typeof window === 'undefined') return;
        const rect = el.getBoundingClientRect();
        // Default below-right of trigger; flip left when it would overflow.
        let left = rect.left;
        if (left + PANEL_W > window.innerWidth - EDGE_PAD) {
            left = Math.max(8, rect.right - PANEL_W);
        }
        const openUp = rect.bottom > window.innerHeight - FLIP_UP_ZONE;
        setPos(openUp
            ? { left, bottom: window.innerHeight - rect.top + GAP }
            : { left, top: rect.bottom + GAP });
        setIsVisible(true);
    };

    const close = () => setIsVisible(false);

    const panel = pos ? (
        <div
            id="tooltip-popup"
            role="tooltip"
            className="z-[100] w-64 p-2.5 text-sm whitespace-pre-line text-slate-900 dark:text-white bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200"
            style={{
                position: 'fixed',
                left: pos.left,
                ...(pos.top !== undefined ? { top: pos.top } : {}),
                ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
                maxHeight: '60vh',
                overflowY: 'auto',
            }}
        >
            {content}
        </div>
    ) : null;

    return (
        <div className="relative inline-block ml-1">
            <button
                ref={triggerRef}
                type="button"
                className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
                onMouseEnter={open}
                onMouseLeave={close}
                onFocus={open}
                onBlur={close}
                aria-label={content}
                aria-describedby={isVisible ? 'tooltip-popup' : undefined}
            >
                <Info className="w-3 h-3 text-slate-500 hover:text-cyan-400 cursor-help" aria-hidden="true" />
            </button>
            {typeof document !== 'undefined' && isVisible && panel && createPortal(panel, document.body)}
        </div>
    );
};
