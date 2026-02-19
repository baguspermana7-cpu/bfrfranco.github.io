import React from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useMaturity } from '../../context/MaturityContext';

export const MaturityRadar: React.FC = () => {
    const { state } = useMaturity();

    const data = state.dimensions.map(d => ({
        subject: d.label,
        A: d.value,
        fullMark: 5,
    }));

    return (
        <div className="h-[400px] w-full bg-slate-800/20 rounded-xl p-4 border border-slate-700/50 flex flex-col items-center justify-center">
            <h3 className="text-sm font-semibold text-slate-400 mb-4 px-2 w-full text-left">Maturity Profile</h3>
            <div className="w-full max-w-[350px] aspect-square relative">
                <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                        <PolarGrid stroke="#334155" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                        <Radar
                            name="Current Maturity"
                            dataKey="A"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            fill="#3b82f6"
                            fillOpacity={0.3}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                            itemStyle={{ color: '#60a5fa' }}
                        />
                    </RadarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
