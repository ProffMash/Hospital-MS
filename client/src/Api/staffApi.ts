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
  const response = await api.get<User[]>(`users/`);
  return response.data;
}

// Fetch a single user by ID
export async function fetchUserById(id: number): Promise<User> {
  const response = await api.get<User>(`users/${id}/`);
  return response.data;
}

// Register / create a new user
// NOTE: backend may return a user object or a message; adapt callers if needed
export async function registerUser(payload: RegisterPayload): Promise<User | any> {
  const response = await api.post(`${AUTH_URL}register/`, payload);
  return response.data;
}

// Update an existing user (partial)
export async function updateUser(id: number, payload: Partial<User>): Promise<User> {
  const response = await api.patch<User>(`users/${id}/`, payload);
  return response.data;
}

// Delete a user
export async function deleteUser(id: number): Promise<void> {
  await api.delete(`users/${id}/`);
}

export default {
  fetchUsers,
  fetchUserById,
  registerUser,
  updateUser,
  deleteUser,
};
