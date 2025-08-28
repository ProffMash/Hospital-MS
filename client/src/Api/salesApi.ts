import api from './apiClient';

export interface Sale {
  id: number;
  medicine: number; // medicine id
  quantity: number;
  total_amount: string;
  created_at: string;
}

// Fetch all sales
export async function fetchSales(): Promise<Sale[]> {
  const response = await api.get<Sale[]>(`sales/`);
  return response.data;
}

// Create a new sale
export async function createSale(sale: Omit<Sale, 'id' | 'created_at' | 'total_amount'>): Promise<Sale> {
  const response = await api.post<Sale>(`sales/`, sale);
  return response.data;
}

// Update an existing sale
export async function updateSale(id: number, sale: Partial<Omit<Sale, 'id' | 'created_at' | 'total_amount'>>): Promise<Sale> {
  const response = await api.put<Sale>(`sales/${id}/`, sale);
  return response.data;
}

// Delete a sale
export async function deleteSale(id: number): Promise<void> {
  await api.delete(`sales/${id}/`);
}

// Fetch a single sale by ID
export async function fetchSaleById(id: number): Promise<Sale> {
  const response = await api.get<Sale>(`sales/${id}/`);
  return response.data;
}
