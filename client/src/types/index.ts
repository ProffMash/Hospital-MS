// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'admin' | 'doctor' | 'pharmacist' | 'receptionist';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
}

// Patient Types
export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  bloodType?: string;
  allergies?: string;
  medicalHistory?: string;
  paymentStatus?: 'paid' | 'not_paid';
  createdAt: string;
  updatedAt: string;
}

// Staff Types
export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'admin' | 'doctor' | 'pharmacist' | 'receptionist';
  address: string;
  specialization?: string;
  licenseNumber?: string;
  createdAt: string;
  updatedAt: string;
}

// Appointment Types
export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  date: string;
  time: string;
  duration: number; // in minutes
  type: 'consultation' | 'follow_up' | 'emergency' | 'procedure';
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  paymentStatus?: 'paid' | 'not_paid';
  reason: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Diagnosis Types
export interface Diagnosis {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId: string;
  symptoms: string;
  diagnosis: string;
  treatmentPlan: string;
  medications?: string[];
  followUpRequired: boolean;
  followUpDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Laboratory Types
export interface LabTest {
  id: string;
  name: string;
  category: string;
  normalRange: string;
  unit: string;
  price: number;
  description?: string;
  preparationInstructions?: string;
}

export interface LabOrder {
  id: string;
  patientId: string;
  doctorId: string;
  testIds: string[];
  status: 'pending' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'routine' | 'urgent' | 'stat';
  orderDate: string;
  sampleCollectedDate?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LabResult {
  id: string;
  orderId: string;
  testId: string;
  // result values are stored as an array of strings (e.g. ["eosinophils","brucella","wbc"]) to match API
  values: string[];
  unit: string;
  normalRange: string;
  status: 'normal' | 'abnormal' | 'critical';
  notes?: string;
  technician: string;
  reviewedBy?: string;
  completedAt: string;
}

// Pharmacy Types
export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  manufacturer: string;
  category: string;
  dosageForm: string; // tablet, capsule, syrup, etc.
  strength: string;
  unit: string;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  price: number;
  costPrice: number;
  expiryDate: string;
  batchNumber: string;
  description?: string;
  sideEffects?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  doctorId: string;
  medications: PrescriptionItem[];
  status: 'pending' | 'dispensed' | 'partially_dispensed' | 'cancelled';
  prescriptionDate: string;
  dispensedDate?: string;
  dispensedBy?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrescriptionItem {
  medicineId: string;
  quantity: number;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  dispensedQuantity?: number;
  unitPrice?: number;
  totalPrice?: number;
}

// Sales Types
export interface Sale {
  id: string;
  prescriptionId?: string;
  medicineId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  saleDate: string;
  customerId?: string;
  customerName?: string;
  saleType?: 'prescription' | 'over_counter';
  createdAt: string;
  updatedAt: string;
}

// Dashboard Statistics
export interface DashboardStats {
  totalPatients: number;
  totalStaff: number;
  todayAppointments: number;
  pendingLabOrders: number;
  lowStockMedicines: number;
  monthlyRevenue: number;
}

// Chart Data Types
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string | string[];
    borderColor?: string | string[];
    borderWidth?: number;
  }[];
}

// Navigation Types
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  roles: UserRole[];
}

// Theme Types
export type Theme = 'light' | 'dark';

// Export Types
export type ExportFormat = 'csv' | 'pdf';

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}