import api from './apiClient';

export interface RegisterPayload {
	email: string;
	password: string;
	name: string;
	role: string;
	specialization?: string;
	phone?: string;
	address?: string;
}

export interface LoginPayload {
	email: string;
	password: string;
}

export interface LoginResponse {
	id: number;
	email: string;
	role: string;
	name: string;
	specialization?: string;
	phone?: string;
	address?: string;
	message: string;
}

export async function registerUser(payload: RegisterPayload): Promise<{ message: string } | any> {
	const response = await api.post(`auth/register/`, payload);
	return response.data;
}

export async function loginUser(payload: LoginPayload): Promise<LoginResponse> {
	const response = await api.post<LoginResponse>(`auth/login/`, payload);
	return response.data;
}

export default {
	registerUser,
	loginUser,
};

