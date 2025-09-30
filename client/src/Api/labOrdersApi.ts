import api from './apiClient';

export interface LabOrder {
	id: number;
	patient: number;
	patient_name: string | null;
	doctor: number | null;
	doctor_name: string | null;
	tests: string[];
	status: string;
	created_at: string;
}

// Fetch all lab orders (Read)
export async function fetchLabOrders(): Promise<LabOrder[]> {
	const response = await api.get<LabOrder[]>(`lab-orders/`);
	// DRF may return a paginated object { results: [...] } or a plain array. Normalize to array.
	const data: any = response.data;
	if (Array.isArray(data)) return data;
	if (data && Array.isArray(data.results)) return data.results;
	return [];
}

// Create a new lab order (Create)
export async function createLabOrder(labOrder: Omit<LabOrder, 'id' | 'created_at' | 'patient_name' | 'doctor_name'>): Promise<LabOrder> {
	// Do not send 'id' when creating a new lab order; let backend assign it
	const response = await api.post<LabOrder>(`lab-orders/`, labOrder);
	return response.data;
}

// Update an existing lab order (Update)
export async function updateLabOrder(id: number, labOrder: Partial<Omit<LabOrder, 'id' | 'created_at' | 'patient_name' | 'doctor_name'>>): Promise<LabOrder> {
	// Only use backend-provided 'id' for updates
	const response = await api.put<LabOrder>(`lab-orders/${id}/`, labOrder);
	return response.data;
}

// Delete a lab order (Delete)
export async function deleteLabOrder(id: number): Promise<void> {
	await api.delete(`lab-orders/${id}/`);
}

// Fetch a single lab order by ID
export async function fetchLabOrderById(id: number): Promise<LabOrder> {
	const response = await api.get<LabOrder>(`lab-orders/${id}/`);
	return response.data;
}

