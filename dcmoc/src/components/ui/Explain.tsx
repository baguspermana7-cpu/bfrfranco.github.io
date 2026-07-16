'use client';

import React, { useEffect, useState } from 'react';
import { Tooltip } from '@/components/ui/Tooltip';
import { explain, ExplainEntry } from '@/lib/explain';

interface ExplainProps {
    /** RZ_EXPLAIN_DB entry key, e.g. 'dscr' or 'tab-invest'. */
    k: string;
}

/**
 * Thin knowledge-DB tooltip: `<Explain k="dscr" />` renders the existing
 * a11y <Tooltip/> with the entry's title + definition (+ formula when
 * present). Renders NOTHING when the DB or the key is absent — safe to
 * wire against keys that may not exist, and SSR-safe (the DB only lives
 * on window, so the first client render after mount resolves it).
 */
export const Explain: React.FC<ExplainProps> = ({ k }) => {
    const [entry, setEntry] = useState<ExplainEntry | null>(null);

    useEffect(() => {
        // Resolve after mount: avoids any SSR/hydration divergence and gives
        // the defer-loaded DB script time to have executed (it runs before
        // Next's deferred body bundles, so this is effectively immediate).
        setEntry(explain(k));
    }, [k]);

    if (!entry) return null;

    const content = `${entry.t} — ${entry.d}${entry.f ? `\nFormula: ${entry.f}` : ''}`;
    return <Tooltip content={content} />;
};
