'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { Lock } from 'lucide-react';

export function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const login = useAuthStore((s) => s.login);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = login(email, password);
        if (!success) {
            setError('Invalid email or password.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-cyan-900/50 mb-4">
                        <Lock className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">DCMOC</h1>
                    <p className="text-slate-400 text-sm mt-1">Data Center M&O Calculator</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
                    <div>
                        <label className="block text-xs text-slate-400 uppercase font-medium mb-1.5">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter email"
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                            autoComplete="email"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-slate-400 uppercase font-medium mb-1.5">Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                            autoComplete="current-password"
                            required
                        />
                    </div>

                    {error && (
                        <p className="text-red-400 text-xs">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/50"
                    >
                        Sign In
                    </button>
                </form>

                <p className="text-center text-slate-500 text-[10px] mt-6 leading-relaxed">
                    By signing in, you agree to our{' '}
                    <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="text-cyan-500 underline hover:text-cyan-400">Terms of Service</a>
                    {' '}and{' '}
                    <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-cyan-500 underline hover:text-cyan-400">Privacy Policy</a>.
                </p>
            </div>
        </div>
    );
}
