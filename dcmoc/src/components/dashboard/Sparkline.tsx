'use client';

import React from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

/** Minimal decorative-but-real sparkline from a genuine series (e.g. cashflow,
 *  occupancy ramp). Renders nothing when no series is supplied — never fakes a trend. */
export function Sparkline({ data, color = '#22d3ee', height = 30 }: { data?: number[]; color?: string; height?: number }) {
    if (!data || data.length < 2) return <div style={{ height }} aria-hidden="true" />;
    const rows = data.map((v, i) => ({ i, v }));
    const id = React.useId().replace(/[:]/g, '');
    return (
        <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rows} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                            <stop offset="100%" stopColor={color} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <YAxis hide domain={['dataMin', 'dataMax']} />
                    <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.6} fill={`url(#sl-${id})`} dot={false} isAnimationActive={false} />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

export default Sparkline;
