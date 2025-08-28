import api from './apiClient';

export interface Patient {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  address: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  medical_history: string | null;
  created_at: string;
  // optional fields the server may return
  updated_at?: string;
  blood_type?: string | null;
  allergies?: string | null;
}

// apiClient sets base URL

// Fetch all patients (Read)
export async function fetchPatients(): Promise<Patient[]> {
  const response = await api.get<Patient[]>(`patients/`);
  return response.data;
}

// Create a new patient (Create)
export async function createPatient(patient: Omit<Partial<Patient>, 'id' | 'created_at'>): Promise<Patient> {
  const response = await api.post<Patient>(`patients/`, patient);
  return response.data;
}

// Update an existing patient (Update)
export async function updatePatient(id: number, patient: Partial<Omit<Patient, 'id' | 'created_at'>>): Promise<Patient> {
  // Use PATCH for partial updates to avoid 400 when server requires all fields on PUT
  const response = await api.patch<Patient>(`patients/${id}/`, patient);
  return response.data;
}

// Delete a patient (Delete)
export async function deletePatient(id: number): Promise<void> {
  await api.delete(`patients/${id}/`);
}

// Fetch a single patient by ID
export async function fetchPatientById(id: number): Promise<Patient> {
  const response = await api.get<Patient>(`patients/${id}/`);
  return response.data;
}
