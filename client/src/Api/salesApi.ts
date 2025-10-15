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
  const data: any = response.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
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

export interface TotalRevenueResponse {
  total_revenue: number;
  currency?: string;
}

// Get total revenue. Accepts optional start_date and end_date (YYYY-MM-DD).
export async function getTotalRevenue(params?: { start_date?: string; end_date?: string; }): Promise<TotalRevenueResponse> {
  // Try the viewset action first, then fallback to top-level endpoint
  try {
    const res = await api.get<TotalRevenueResponse>(`sales/total_revenue/`, { params });
    return res.data;
  } catch (err) {
    // fallback to top-level route
    const res = await api.get<TotalRevenueResponse>(`total_revenue/`, { params });
    return res.data;
  }
}

export interface TodaySalesResponse {
  date: string;
  sales: Sale[];
  total_revenue: number;
  sales_count: number;
}

// Get today's sales and revenue
export async function getTodaySales(): Promise<TodaySalesResponse> {
  try {
    const res = await api.get<TodaySalesResponse>(`sales/today_sales/`);
    return res.data;
  } catch (err) {
    const res = await api.get<TodaySalesResponse>(`today_sales/`);
    return res.data;
  }
}
