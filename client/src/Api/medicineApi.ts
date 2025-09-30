import api from './apiClient';

export interface Medicine {
  id: number;
  name: string;
  category: string;
  description: string;
  stock: number;
  price: string;
  created_at: string;
}

// Fetch all medicines (Read)
export async function fetchMedicines(): Promise<Medicine[]> {
  const response = await api.get<Medicine[]>(`medicines/`);
  const data: any = response.data;
  // DRF paginated responses have the shape { results: [...] }. Normalize to plain array.
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// Create a new medicine (Create)
export async function createMedicine(medicine: Omit<Medicine, 'id' | 'created_at'>): Promise<Medicine> {
  const response = await api.post<Medicine>(`medicines/`, medicine);
  return response.data;
}

// Update an existing medicine (Update)
export async function updateMedicine(id: number, medicine: Partial<Omit<Medicine, 'id' | 'created_at'>>): Promise<Medicine> {
  const response = await api.put<Medicine>(`medicines/${id}/`, medicine);
  return response.data;
}

// Delete a medicine (Delete)
export async function deleteMedicine(id: number): Promise<void> {
  await api.delete(`medicines/${id}/`);
}

// Fetch a single medicine by ID
export async function fetchMedicineById(id: number): Promise<Medicine> {
  const response = await api.get<Medicine>(`medicines/${id}/`);
  return response.data;
}
