import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole, AuthState } from '../types';
import { loginUser } from '../Api/authApi';
import { setAuthToken } from '../Api/apiClient';
import { useHospitalStore } from './hospitalStore';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,

      login: async (email: string, password: string) => {
        try {
          const resp = await loginUser({ email, password });
          // adapt API response shape to local User type
          const normalizeRole = (r: string | undefined): UserRole => {
            const rr = (r || '').toLowerCase();
            if (rr === 'pharmacist' || rr === 'pharmacy') return 'pharmacist';
            if (rr === 'doctor') return 'doctor';
            if (rr === 'admin' || rr === 'administrator') return 'admin';
            if (rr === 'receptionist' || rr === 'reception') return 'receptionist';
            // default to 'pharmacist' when unknown to avoid breaking the UI
            return 'pharmacist';
          };

          const user: User = {
            id: String(resp.id),
            email: resp.email,
            name: resp.name,
            role: normalizeRole((resp as any).role),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const token = (resp as any).token || null;
          set({ user, isAuthenticated: true, token });
          // update axios default header
          setAuthToken(token);
          // After successful login, sync hospital store from server so state is consistent across devices
          try {
            // call syncFromServer if available
            const hs = useHospitalStore.getState();
            if (typeof hs.syncFromServer === 'function') {
              hs.syncFromServer();
            }
          } catch (e) {
            console.warn('Failed to sync hospital store after login', e);
          }
          return true;
        } catch (err) {
          // API login failed: do not fall back to mock; return false
          return false;
        }
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
          token: null,
        });
        setAuthToken(null);
        // Clear hospital store to avoid leaking data between users/devices
        try {
          // reset arrays to empty so next login will fetch fresh data
          useHospitalStore.setState({
            patients: [],
            staff: [],
            diagnoses: [],
            labOrders: [],
            labResults: [],
            appointments: [],
            medicines: [],
            prescriptions: [],
            labTests: [],
            sales: [],
          } as any);
        } catch (e) {
          // ignore
        }
      },

      updateUser: (userData: Partial<User>) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        }));
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        token: state.token,
      }),
    }
  )
);

// Apply persisted token on module load (for page refreshes)
try {
  const raw = localStorage.getItem('auth-storage');
  if (raw) {
    const parsed = JSON.parse(raw);
    const token = parsed?.state?.token || parsed?.token || null;
    if (token) setAuthToken(token);
  }
} catch (e) {
  // ignore
}