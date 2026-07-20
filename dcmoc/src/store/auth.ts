import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'root' | 'user';

export interface AuthUser {
    email: string;
    role: UserRole;
}

interface AuthState {
    user: AuthUser | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
}

// DCMOC is root-only. Access control = email allowlist (mirrors auth.js ROOT_EMAILS)
// + real Supabase password check. Never embed a password in the client bundle.
const ROOT_EMAILS = ['admin@resistancezero.com', 'bagus@resistancezero.com'];

export interface RzSupa {
    ready?: Promise<unknown>;
    signIn: (email: string, password: string) => Promise<{ error?: unknown } | null>;
}

declare global {
    interface Window {
        rzSupa?: RzSupa;
    }
}

// Lazy-load the site's shared Supabase client (js/rz-config.js + js/rz-supabase.js,
// same origin) — the same on-demand pattern auth.js uses, so DCMOC stays in lockstep
// with the sitewide Supabase-primary login.
let supaPromise: Promise<RzSupa | null> | null = null;

function ensureSupa(): Promise<RzSupa | null> {
    if (typeof window === 'undefined') return Promise.resolve(null);
    if (window.rzSupa) return Promise.resolve(window.rzSupa);
    if (!supaPromise) {
        supaPromise = new Promise((resolve) => {
            const cfg = document.createElement('script');
            cfg.src = '/js/rz-config.js';
            cfg.onload = () => {
                const mod = document.createElement('script');
                mod.type = 'module';
                mod.src = '/js/rz-supabase.js';
                mod.onload = () => {
                    // module sets window.rzSupa during evaluation; poll briefly to be safe
                    const t0 = Date.now();
                    const poll = () => {
                        if (window.rzSupa) resolve(window.rzSupa);
                        else if (Date.now() - t0 > 8000) resolve(null);
                        else setTimeout(poll, 100);
                    };
                    poll();
                };
                mod.onerror = () => resolve(null);
                document.head.appendChild(mod);
            };
            cfg.onerror = () => resolve(null);
            document.head.appendChild(cfg);
        });
    }
    return supaPromise;
}

/** Shared lazy loader for the sitewide Supabase client (window.rzSupa).
 *  Exported so lib/cloudProjects.ts reuses the exact same script-injection
 *  path as login — one loader, one client instance. Resolves null when the
 *  scripts can't load (offline / blocked). */
export function getRzSupa(): Promise<RzSupa | null> {
    return ensureSupa();
}

// Adopt an existing sitewide root session (rz_premium_session, written by the shared
// auth.js modal) so a root user already signed in on the main site enters seamlessly.
function siteSessionUser(): AuthUser | null {
    try {
        const raw = localStorage.getItem('rz_premium_session');
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || (s.expires && Date.now() > s.expires)) return null;
        const email = String(s.email || '').toLowerCase().trim();
        if (s.role === 'root' && ROOT_EMAILS.includes(email)) return { email, role: 'root' };
    } catch {
        /* corrupt session — ignore */
    }
    return null;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            login: async (email: string, password: string) => {
                const e = email.toLowerCase().trim();
                if (!ROOT_EMAILS.includes(e)) return false;
                const supa = await ensureSupa();
                if (!supa) return false;
                try {
                    if (supa.ready) await supa.ready;
                    const res = await supa.signIn(e, password);
                    if (!res || res.error) return false;
                } catch {
                    return false;
                }
                set({ user: { email: e, role: 'root' } });
                return true;
            },
            logout: () => set({ user: null }),
        }),
        {
            name: 'dcmoc-auth',
            merge: (persisted, current) => {
                const merged = { ...current, ...((persisted as Partial<AuthState>) || {}) };
                if (!merged.user) {
                    const su = siteSessionUser();
                    if (su) merged.user = su;
                }
                return merged;
            },
        }
    )
);
