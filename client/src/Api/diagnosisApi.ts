import api from './apiClient';

export interface PrescribedMedicine {
  medicine_id?: number;
  name: string;
  dosage?: string; // for old format
  dose?: string;   // for new format
  frequency?: string;
  duration?: string; // for old format
  duration_days?: number; // for new format
}

export interface Diagnosis {
  id: number;
  patient: number;
  patient_name?: string | null;
  doctor?: number | null;
  doctor_name?: string | null;
  symptoms: string;
  treatment_plan: string;
  diagnosis: string;
  prescribed_medicines: PrescribedMedicine[];
  additional_notes?: string | null;
  created_at: string;
}

// Fetch all diagnoses (Read)
export async function fetchDiagnoses(): Promise<Diagnosis[]> {
  const response = await api.get<any>(`diagnoses/`);
  if (response && response.data) {
    const d = response.data;
    if (Array.isArray(d)) return d as Diagnosis[];
    if (Array.isArray(d.results)) return d.results as Diagnosis[];
  }
  return [] as Diagnosis[];
}

// Create a new diagnosis (Create)
export async function createDiagnosis(diagnosis: Omit<Diagnosis, 'id' | 'created_at' | 'patient_name' | 'doctor_name'>): Promise<Diagnosis> {
  const response = await api.post<Diagnosis>(`diagnoses/`, diagnosis);
  return response.data;
}

// Update an existing diagnosis (Update)
export async function updateDiagnosis(id: number, diagnosis: Partial<Omit<Diagnosis, 'id' | 'created_at' | 'patient_name' | 'doctor_name'>>): Promise<Diagnosis> {
  const response = await api.put<Diagnosis>(`diagnoses/${id}/`, diagnosis);
  return response.data;
}

// Delete a diagnosis (Delete)
export async function deleteDiagnosis(id: number): Promise<void> {
  await api.delete(`diagnoses/${id}/`);
}

// Fetch a single diagnosis by ID
export async function fetchDiagnosisById(id: number): Promise<Diagnosis> {
  const response = await api.get<Diagnosis>(`diagnoses/${id}/`);
  return response.data;
}








// import axios from 'axios';

// const API_URL = 'http://127.0.0.1:8000/api/diagnoses/';

// export interface PrescribedMedicine {
//   medicine_id?: number;
//   name: string;
//   dosage?: string; // for old format
//   dose?: string;   // for new format
//   frequency?: string;
//   duration?: string; // for old format
//   duration_days?: number; // for new format
// }

// export interface Diagnosis {
//   id: number;
//   patient: string;
//   doctor: string | null;
//   symptoms: string;
//   treatment_plan: string;
//   diagnosis: string;
//   prescribed_medicines: PrescribedMedicine[];
//   additional_notes: string | null;
//   created_at: string;
// }

// export interface DiagnosisCreate {
//   patient: string;
//   doctor?: string | null;
//   symptoms: string;
//   treatment_plan: string;
//   diagnosis: string;
//   prescribed_medicines: PrescribedMedicine[];
//   additional_notes?: string | null;
// }

// // Fetch all diagnoses (Read)
// export async function fetchDiagnoses(): Promise<Diagnosis[]> {
//   const response = await axios.get<Diagnosis[]>(API_URL);
//   return response.data;
// }

// // Create a new diagnosis (Create)
// export async function createDiagnosis(data: DiagnosisCreate): Promise<Diagnosis> {
//   const response = await axios.post<Diagnosis>(API_URL, data);
//   return response.data;
// }

// // Update an existing diagnosis (Update)
// export async function updateDiagnosis(id: number, data: Partial<DiagnosisCreate>): Promise<Diagnosis> {
//   const response = await axios.put<Diagnosis>(`${API_URL}${id}/`, data);
//   return response.data;
// }

// // Delete a diagnosis (Delete)
// export async function deleteDiagnosis(id: number): Promise<void> {
//   await axios.delete(`${API_URL}${id}/`);
// }

// // Fetch a single diagnosis by ID
// export async function fetchDiagnosisById(id: number): Promise<Diagnosis> {
//   const response = await axios.get<Diagnosis>(`${API_URL}${id}/`);
//   return response.data;
// }
