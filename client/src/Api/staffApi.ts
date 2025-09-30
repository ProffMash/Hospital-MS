import api from './apiClient';

export interface User {
  id: number;
  email: string;
  role: string;
  name: string;
  specialization?: string | null;
  phone?: string | null;
  address?: string | null;
  is_staff?: boolean;
  is_superuser?: boolean;
  groups?: any[];
  user_permissions?: any[];
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: string;
  specialization?: string;
  phone?: string;
  address?: string;
}

const AUTH_URL = 'auth/';

// Fetch all users
export async function fetchUsers(): Promise<User[]> {
  const response = await api.get<any>(`users/`);
  if (response && response.data) {
    const d = response.data;
    if (Array.isArray(d)) return d as User[];
    if (Array.isArray(d.results)) return d.results as User[];
  }
  return [] as User[];
}

// Fetch a single user by ID
export async function fetchUserById(id: number | string): Promise<User> {
  const idStr = String(id);
  const idNum = Number(idStr);
  if (idStr === '' || Number.isNaN(idNum)) {
    throw new Error(`fetchUserById: invalid id provided: ${id}`);
  }
  const response = await api.get<User>(`users/${idStr}/`);
  return response.data;
}

// Register / create a new user
// NOTE: backend may return a user object or a message
export async function registerUser(payload: RegisterPayload): Promise<User | any> {
  try {
    const response = await api.post(`${AUTH_URL}register/`, payload);
    return response.data;
  } catch (err: any) {
    // Prefer throwing the server validation payload so callers can inspect field errors
    if (err?.response?.data) {
      throw err.response.data;
    }
    throw err;
  }
}

// Update an existing user (partial)
export async function updateUser(id: number | string, payload: Partial<User>): Promise<User> {
  const idStr = String(id);
  const idNum = Number(idStr);
  if (idStr === '' || Number.isNaN(idNum)) {
    throw new Error(`updateUser: invalid id provided: ${id}`);
  }
  const response = await api.patch<User>(`users/${idStr}/`, payload);
  return response.data;
}

// Delete a user
export async function deleteUser(id: number | string): Promise<void> {
  const idStr = String(id);
  const idNum = Number(idStr);
  if (idStr === '' || Number.isNaN(idNum)) {
    throw new Error(`deleteUser: invalid id provided: ${id}`);
  }
  await api.delete(`users/${idStr}/`);
}

export default {
  fetchUsers,
  fetchUserById,
  registerUser,
  updateUser,
  deleteUser,
};
