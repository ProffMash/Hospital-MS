import React, { useEffect, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { fetchUserById, updateUser } from '../../Api/staffApi';
import { Card } from '../UI/Card';
import FadeLoader from '../UI/FadeLoader';

type DisplayUser = {
  email?: string | null;
  role?: string | null;
  name?: string | null;
  specialization?: string | null;
  phone?: string | null;
  address?: string | null;
};

type Props = {
  // optional user object (backend shape) — if provided, component will use it
  user?: DisplayUser | null;
};

const Item: React.FC<{ label: string; value?: any }> = ({ label, value }) => (
  <div className="flex items-start gap-4">
    <div className="w-32 font-medium text-sm text-gray-500">{label}</div>
    <div className="text-sm text-gray-800 dark:text-gray-200">{value ?? '—'}</div>
  </div>
);

const initials = (name?: string | null) => {
  if (!name) return 'U';
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

const avatarGradient = (seed?: string | null) => {
  const s = (seed || 'user').split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const idx = s % 6;
  return [
    'from-pink-500 to-yellow-500',
    'from-indigo-500 to-purple-500',
    'from-emerald-400 to-teal-500',
    'from-sky-400 to-indigo-500',
    'from-rose-400 to-orange-400',
    'from-violet-500 to-fuchsia-500',
  ][idx];
};

const Profile: React.FC<Props> = ({ user: propUser = null }) => {
  const authUser = useAuthStore((s) => s.user);
  const authUpdate = useAuthStore((s) => s.updateUser);

  const [backendUser, setBackendUser] = useState<DisplayUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<DisplayUser>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Try to load full user data from backend using ID from auth store when needed
  useEffect(() => {
    let cancelled = false;
    // if caller provided a user, don't fetch
    if (propUser) return;
    if (!authUser) return;

    // auth store may store id as string
    const rawId: any = (authUser as any).id ?? authUser.id;
    const id = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
    if (!id || Number.isNaN(id)) return;

    setLoading(true);
    fetchUserById(id)
      .then((u) => {
        if (cancelled) return;
        setBackendUser({
          name: (u as any).name ?? u.name,
          email: (u as any).email ?? u.email,
          role: (u as any).role ?? (u as any).role,
          specialization: (u as any).specialization ?? null,
          phone: (u as any).phone ?? null,
          address: (u as any).address ?? null,
        });
      })
      .catch(() => {
        // ignore — we will fall back to auth store
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authUser, propUser]);

  // initialize form when user data is available
  useEffect(() => {
    const u = propUser || backendUser || (authUser ? {
      email: authUser.email,
      role: (authUser as any).role ?? authUser.role,
      name: authUser.name,
      specialization: (authUser as any).specialization ?? null,
      phone: (authUser as any).phone ?? null,
      address: (authUser as any).address ?? null,
    } : null);
    if (u) setForm({ ...u });
  }, [propUser, backendUser, authUser]);

  const user: DisplayUser | null =
    propUser || backendUser ||
    (authUser
      ? {
          email: authUser.email,
          role: (authUser as any).role ?? authUser.role,
          name: authUser.name,
          specialization: (authUser as any).specialization ?? null,
          phone: (authUser as any).phone ?? null,
          address: (authUser as any).address ?? null,
        }
      : null);

  if (!user) {
    return <div className="p-4 text-sm text-gray-500">No user data available</div>;
  }
  if (loading) {
    return (
      <div className="p-6 text-center">
        <FadeLoader size={36} />
        <div className="mt-3 text-sm text-gray-500">Loading profile...</div>
      </div>
    );
  }
  const onChange = (k: keyof DisplayUser, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    if (!authUser) {
      setError('Not authenticated');
      return;
    }
    // basic validation: name and email required
    if (!form.name || !form.email) {
      setError('Name and email are required');
      return;
    }

    // get id
    const rawId: any = (authUser as any).id ?? authUser.id;
    const id = typeof rawId === 'string' ? parseInt(rawId, 10) : rawId;
    if (!id || Number.isNaN(id)) {
      setError('Invalid user id');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<any> = {
        name: form.name,
        email: form.email,
        specialization: form.specialization,
        phone: form.phone,
        address: form.address,
      };
      const updated = await updateUser(id, payload);
      // update local state and auth store
      setBackendUser({
        name: updated.name,
        email: updated.email,
        role: (updated as any).role ?? user.role,
        specialization: (updated as any).specialization ?? null,
        phone: (updated as any).phone ?? null,
        address: (updated as any).address ?? null,
      });
      // update auth store's user for immediate app-wide reflection (only known fields)
      if (authUpdate) {
        authUpdate({
          name: updated.name,
          email: updated.email,
          role: (updated as any).role ?? user?.role,
        } as any);
      }
      setSuccess('Profile updated');
      setEditing(false);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-sm md:text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Profile</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Manage your account and personal information</p>
        </div>
      </div>

      <Card className="max-w-2xl mx-auto p-0 overflow-hidden">
        {/* Banner */}
        <div className={`h-28 bg-gradient-to-r ${avatarGradient(user.name)} opacity-95`} />

        <div className="p-6 md:p-8">
          <div className="-mt-12 flex items-center gap-4">
            <div className="relative">
              <div className={`w-20 h-20 rounded-full ring-2 ring-white dark:ring-slate-900 bg-gradient-to-br ${avatarGradient(
                user.name
              )} flex items-center justify-center text-white text-2xl font-semibold shadow-lg`}> 
                {initials(user.name)}
              </div>
              <div className="absolute -bottom-2 -right-2">
                {!editing ? (
                  <button onClick={() => setEditing(true)} className="bg-white dark:bg-slate-700 p-1 rounded-full shadow text-sky-600 hover:scale-105 transform transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 010 2.828l-9.192 9.192a1 1 0 01-.464.263l-4 1a1 1 0 01-1.213-1.213l1-4a1 1 0 01.263-.464l9.192-9.192a2 2 0 012.828 0z"/></svg>
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(false); setForm(user ?? {}); setError(null); setSuccess(null); }} className="bg-white dark:bg-slate-700 p-1 rounded-full shadow text-gray-700 hover:scale-105 transform transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 9.293a1 1 0 011.414 0L10 13.586l4.293-4.293a1 1 0 111.414 1.414l-5 5a1 1 0 01-1.414 0l-5-5a1 1 0 010-1.414z" clipRule="evenodd"/></svg>
                    </button>
                    <button onClick={handleSave} disabled={saving} className="bg-sky-600 text-white p-1 rounded-full shadow disabled:opacity-60 hover:scale-105 transform transition">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M16.707 5.293a1 1 0 00-1.414 0L8 12.586l-3.293-3.293a1 1 0 10-1.414 1.414l4 4a1 1 0 001.414 0l8-8a1 1 0 000-1.414z"/></svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-gray-100">{user.name}</h2>
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200">{user.role}</span>
              </div>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">{user.specialization ?? 'No specialization listed'}</p>
            </div>
          </div>

          <div className="mt-6">
            {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
            {success && <div className="mb-3 text-sm text-green-600">{success}</div>}

            {!editing ? (
              <div className="grid grid-cols-1 gap-3">
                <Item label="Email" value={user.email} />
                <Item label="Phone" value={user.phone} />
                <Item label="Address" value={user.address} />
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Name</label>
                    <input value={form.name ?? ''} onChange={(e) => onChange('name', e.target.value)} className="w-full p-2 border border-gray-200 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Email</label>
                    <input value={form.email ?? ''} onChange={(e) => onChange('email', e.target.value)} className="w-full p-2 border border-gray-200 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Specialization</label>
                    <input value={form.specialization ?? ''} onChange={(e) => onChange('specialization', e.target.value)} className="w-full p-2 border border-gray-200 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Phone</label>
                    <input value={form.phone ?? ''} onChange={(e) => onChange('phone', e.target.value)} className="w-full p-2 border border-gray-200 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">Address</label>
                  <input value={form.address ?? ''} onChange={(e) => onChange('address', e.target.value)} className="w-full p-2 border border-gray-200 rounded-md bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-300" />
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setEditing(false); setForm(user ?? {}); setError(null); setSuccess(null); }} className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">Cancel</button>
                  <button type="submit" disabled={saving} className="px-4 py-2 rounded-md bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60">{saving ? 'Saving...' : 'Save changes'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Profile;
