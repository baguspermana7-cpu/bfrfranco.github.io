import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'root' | 'user';

export interface AuthUser {
    email: string;
    role: UserRole;
}

interface AuthState {
    user: AuthUser | null;
    login: (email: string, password: string) => boolean;
    logout: () => void;
}

const ACCOUNTS: { email: string; password: string; role: UserRole }[] = [
    { email: 'admin@resistancezero.com', password: 'RZ@Premium2026!', role: 'root' },
    { email: 'bagus@resistancezero.com', password: 'RZ@Premium2026!', role: 'root' },
];

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            login: (email: string, password: string) => {
                const account = ACCOUNTS.find(
                    (a) => a.email.toLowerCase() === email.toLowerCase() && a.password === password
                );
                if (account) {
                    set({ user: { email: account.email, role: account.role } });
                    return true;
                }
                return false;
            },
            logout: () => set({ user: null }),
        }),
        { name: 'dcmoc-auth' }
    )
);
