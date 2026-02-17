import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { useMaturity } from '../../context/MaturityContext';

export const WaterfallAnalysis: React.FC = () => {
    const { state, derived } = useMaturity();

    // Calculate contribution: (value * weight / 4) * 100
    // Total should sum to composite score
    const data = state.dimensions.map(d => ({
        name: d.label,
        value: ((d.value * d.weight) / 4) * 100,
        fill: d.value >= 4 ? '#10b981' : d.value >= 3 ? '#3b82f6' : '#f59e0b'
    }));

    // Add total bar
    const totalData = [
        ...data,
        { name: 'Total', value: derived.compositeScore, fill: '#6366f1', isTotal: true }
    ];

    return (
        <div className="h-[300px] w-full bg-slate-800/20 rounded-xl p-4 border border-slate-700/50">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 px-2">Score Contribution</h3>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={totalData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={0} />
                    <YAxis hide />
                    <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }}
                        formatter={(val: number | undefined) => [val?.toFixed(1) ?? '0.0', 'Contribution']}
                    />
                    <ReferenceLine y={0} stroke="#334155" />
                    <Bar dataKey="value">
                        {totalData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};
