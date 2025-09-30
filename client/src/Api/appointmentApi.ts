import api from './apiClient';

export interface Appointment {
  id: number;
  patient: number;
  doctor: number;
  date: string; // ISO 8601
  time: string; // HH:MM:SS
  reason: string;
  status: 'scheduled' | 'completed' | 'canceled';
  // payment status for appointment
  payment_status?: 'paid' | 'not_paid';
}

// Fetch all appointments (Read)
export async function fetchAppointments(): Promise<Appointment[]> {
  const response = await api.get<any>(`appointments/`);
  if (response && response.data) {
    const d = response.data;
    if (Array.isArray(d)) return d as Appointment[];
    if (Array.isArray(d.results)) return d.results as Appointment[];
  }
  return [] as Appointment[];
}

// Create a new appointment (Create)
export async function createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment> {
  const response = await api.post<Appointment>(`appointments/`, appointment);
  return response.data;
}

// Update an existing appointment (Update)
export async function updateAppointment(id: number, appointment: Partial<Omit<Appointment, 'id'>>): Promise<Appointment> {
  // Use PATCH for partial updates (backend ModelViewSet expects full object for PUT)
  const response = await api.patch<Appointment>(`appointments/${id}/`, appointment);
  return response.data;
}

// Delete an appointment (Delete)
export async function deleteAppointment(id: number): Promise<void> {
  await api.delete(`appointments/${id}/`);
}

// Fetch a single appointment by ID
export async function fetchAppointmentById(id: number): Promise<Appointment> {
  const response = await api.get<Appointment>(`appointments/${id}/`);
  return response.data;
}
