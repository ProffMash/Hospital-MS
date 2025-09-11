import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchAppointments as apiFetchAppointments,
  createAppointment as apiCreateAppointment,
  updateAppointment as apiUpdateAppointment,
  deleteAppointment as apiDeleteAppointment,
} from '../Api/appointmentApi';
import type { 
  Patient, 
  Staff, 
  Appointment, 
  Diagnosis, 
  Medicine, 
  Prescription, 
  LabTest, 
  LabOrder, 
  LabResult,
  Sale
} from '../types';

// NewSale mirrors Sale but makes `saleType` optional so UI can add sales without that field
type NewSale = Omit<Sale, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<Sale, 'saleType'>>;

interface HospitalStore {
  // Patients
  patients: Patient[];
  // Replace entire patients array (used when syncing from backend)
  setPatients: (patients: Patient[]) => void;
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePatient: (id: string, patient: Partial<Patient>) => void;
  deletePatient: (id: string) => void;

  // Staff
  staff: Staff[];
  // Replace entire staff array (used when syncing from backend)
  setStaff: (staff: Staff[]) => void;
  addStaff: (staff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateStaff: (id: string, staff: Partial<Staff>) => void;
  deleteStaff: (id: string) => void;

  // Appointments
  appointments: Appointment[];
  fetchAppointments: () => Promise<void>;
  addAppointment: (appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAppointment: (id: string, appointment: Partial<Appointment>) => Promise<void>;
  deleteAppointment: (id: string) => Promise<void>;

  // Diagnoses
  diagnoses: Diagnosis[];
  // Replace entire diagnoses array (used when syncing from backend)
  setDiagnoses: (diagnoses: Diagnosis[]) => void;
  addDiagnosis: (diagnosis: Omit<Diagnosis, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateDiagnosis: (id: string, diagnosis: Partial<Diagnosis>) => void;

  // Medicines
  medicines: Medicine[];
  addMedicine: (medicine: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateMedicine: (id: string, medicine: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;

  // Prescriptions
  prescriptions: Prescription[];
  addPrescription: (prescription: Omit<Prescription, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updatePrescription: (id: string, prescription: Partial<Prescription>) => void;

  // Lab Tests
  labTests: LabTest[];
  addLabTest: (labTest: LabTest) => void;
  updateLabTest: (id: string, labTest: Partial<LabTest>) => void;

  // Lab Orders
  labOrders: LabOrder[];
  // Replace entire labOrders array (used when syncing from backend)
  setLabOrders: (labOrders: LabOrder[]) => void;
  addLabOrder: (labOrder: LabOrder) => void;
  updateLabOrder: (id: string, labOrder: Partial<LabOrder>) => void;
  // Remove a lab order
  deleteLabOrder: (id: string) => void;

  // Lab Results
  labResults: LabResult[];
  // Replace entire labResults array (used when syncing from backend)
  setLabResults: (labResults: LabResult[]) => void;
  // Remove a lab result
  deleteLabResult: (id: string) => void;
  addLabResult: (labResult: LabResult) => void;
  updateLabResult: (id: string, labResult: Partial<LabResult>) => void;

  // Sales
  sales: Sale[];
  addSale: (sale: NewSale) => void;
  updateSale: (id: string, sale: Partial<Sale>) => void;
}

const generateId = () => Date.now().toString() + Math.random().toString(36).substr(2, 9);

export const useHospitalStore = create<HospitalStore>()(
  persist(
    (set) => ({
      // Initial state
      patients: [],
      staff: [],
      setStaff: (staff) => {
        set(() => ({ staff }));
      },
  appointments: [],
      diagnoses: [],
      setDiagnoses: (diagnoses) => {
        set(() => ({ diagnoses }));
      },
      medicines: [],
      prescriptions: [],
      labTests: [],
      labOrders: [],
      // labResults storage and setter
      labResults: [],
      setLabResults: (labResults) => {
        set(() => ({ labResults }));
      },
      setLabOrders: (labOrders) => {
        // Normalize backend-shaped lab order objects into the UI shape
        const normalized = (labOrders || []).map((o: any) => {
          const patientId = o.patientId ?? (o.patient ? String(o.patient) : '');
          const doctorId = o.doctorId ?? (o.doctor ? String(o.doctor) : '');
          const testIds = o.testIds ?? (o.tests ? (typeof o.tests === 'string' ? String(o.tests).split(',').map((s: string) => s.trim()) : o.tests) : []);
          const orderDate = o.orderDate ?? o.created_at ?? new Date().toISOString();
          return {
            id: String(o.id),
            patientId,
            doctorId,
            testIds,
            status: o.status ?? 'pending',
            priority: o.priority ?? 'routine',
            orderDate,
            notes: o.notes ?? '',
            createdAt: o.created_at ?? o.createdAt ?? new Date().toISOString(),
            updatedAt: o.updated_at ?? o.updatedAt ?? new Date().toISOString(),
          } as any;
        });

        set(() => ({ labOrders: normalized }));
      },
      sales: [],

      // Patient operations
      setPatients: (patients) => {
        set(() => ({ patients }));
      },
      addPatient: (patient) => {
        set((state) => ({
          patients: [
            ...state.patients,
            {
              ...patient,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updatePatient: (id, patient) => {
        set((state) => ({
          patients: state.patients.map((p) =>
            p.id === id
              ? { ...p, ...patient, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      deletePatient: (id) => {
        set((state) => ({
          patients: state.patients.filter((p) => p.id !== id),
        }));
      },

      // Staff operations
      addStaff: (staff) => {
        set((state) => ({
          staff: [
            ...state.staff,
            {
              ...staff,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updateStaff: (id, staff) => {
        set((state) => ({
          staff: state.staff.map((s) =>
            s.id === id
              ? { ...s, ...staff, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
      },

      deleteStaff: (id) => {
        set((state) => ({
          staff: state.staff.filter((s) => s.id !== id),
        }));
      },

      // Appointment operations
      // Appointment operations backed by API
      fetchAppointments: async () => {
        try {
          const list = await apiFetchAppointments();
          // map API shape to UI shape
          const mapped = list.map(a => {
            const d = new Date(a.date);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return {
              id: String(a.id),
              patientId: String(a.patient),
              doctorId: String(a.doctor),
              date: d.toISOString().split('T')[0],
              time: `${hh}:${mm}`,
              duration: 30,
              type: 'consultation',
              reason: a.reason,
              status: a.status === 'canceled' ? 'cancelled' : a.status,
              // map backend appointment payment_status
              paymentStatus: (a as any).payment_status ?? 'not_paid',
              createdAt: d.toISOString(),
              updatedAt: d.toISOString(),
            } as Appointment;
          });
          set(() => ({ appointments: mapped }));
        } catch (err) {
          console.error('Failed to fetch appointments', err);
        }
      },

      addAppointment: async (appointment) => {
        try {
          const dateTime = new Date(`${appointment.date}T${appointment.time}`);
          const payload = {
            patient: Number(appointment.patientId),
            doctor: Number(appointment.doctorId),
            date: dateTime.toISOString(),
            // backend expects a separate time field (TimeField) in addition to the datetime
            // provide full HH:MM:SS to satisfy DRF TimeField parsing
            time: dateTime.toISOString().split('T')[1].slice(0,8),
            reason: appointment.reason,
            status: appointment.status || 'scheduled',
            // include payment status when creating if provided
            payment_status: (appointment as any).paymentStatus ?? undefined,
          } as any;
          const resp = await apiCreateAppointment(payload);
          const d = new Date(resp.date);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const mapped: Appointment = {
            id: String(resp.id),
            patientId: String(resp.patient),
            doctorId: String(resp.doctor),
            date: d.toISOString().split('T')[0],
            time: `${hh}:${mm}`,
            duration: appointment.duration || 30,
            type: appointment.type || 'consultation',
            reason: resp.reason,
            status: resp.status === 'canceled' ? 'cancelled' : resp.status,
            paymentStatus: (resp as any).payment_status ?? 'not_paid',
            createdAt: d.toISOString(),
            updatedAt: d.toISOString(),
          };
          set((state) => ({ appointments: [mapped, ...state.appointments] }));
        } catch (err) {
          console.error('Failed to add appointment', err);
        }
      },

      updateAppointment: async (id, appointment) => {
        try {
          const idNum = Number(id);
          const payload: any = {};
          if (appointment.date && appointment.time) {
            const dt = new Date(`${appointment.date}T${appointment.time}`);
            payload.date = dt.toISOString();
            // also send explicit time field to match backend TimeField
            payload.time = dt.toISOString().split('T')[1].slice(0,8);
          }
          if (appointment.reason) payload.reason = appointment.reason;
          if (appointment.status) payload.status = appointment.status === 'cancelled' ? 'canceled' : appointment.status;
          if ((appointment as any).doctorId) payload.doctor = Number((appointment as any).doctorId);
          if ((appointment as any).patientId) payload.patient = Number((appointment as any).patientId);
          if ((appointment as any).paymentStatus) payload.payment_status = (appointment as any).paymentStatus;

          const resp = await apiUpdateAppointment(idNum, payload);
          const d = new Date(resp.date);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const mapped: Appointment = {
            id: String(resp.id),
            patientId: String(resp.patient),
            doctorId: String(resp.doctor),
            date: d.toISOString().split('T')[0],
            time: `${hh}:${mm}`,
            duration: appointment.duration || 30,
            type: (appointment.type as Appointment['type']) || 'consultation',
            reason: resp.reason,
            status: resp.status === 'canceled' ? 'cancelled' : resp.status,
            paymentStatus: (resp as any).payment_status ?? 'not_paid',
            createdAt: d.toISOString(),
            updatedAt: d.toISOString(),
          };
          set((state) => ({ appointments: state.appointments.map(a => a.id === String(resp.id) ? mapped : a) }));
        } catch (err) {
          console.error('Failed to update appointment', err);
        }
      },

      deleteAppointment: async (id) => {
        try {
          const idNum = Number(id);
          await apiDeleteAppointment(idNum);
          set((state) => ({ appointments: state.appointments.filter((a) => a.id !== id) }));
        } catch (err) {
          console.error('Failed to delete appointment', err);
        }
      },

      // Diagnosis operations
      addDiagnosis: (diagnosis) => {
        set((state) => ({
          diagnoses: [
            ...state.diagnoses,
            {
              ...diagnosis,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updateDiagnosis: (id, diagnosis) => {
        set((state) => ({
          diagnoses: state.diagnoses.map((d) =>
            d.id === id
              ? { ...d, ...diagnosis, updatedAt: new Date().toISOString() }
              : d
          ),
        }));
      },

      // Medicine operations
      addMedicine: (medicine) => {
        set((state) => ({
          medicines: [
            ...state.medicines,
            {
              ...medicine,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updateMedicine: (id, medicine) => {
        set((state) => ({
          medicines: state.medicines.map((m) =>
            m.id === id
              ? { ...m, ...medicine, updatedAt: new Date().toISOString() }
              : m
          ),
        }));
      },

      deleteMedicine: (id) => {
        set((state) => ({
          medicines: state.medicines.filter((m) => m.id !== id),
        }));
      },

      // Prescription operations
      addPrescription: (prescription) => {
        set((state) => ({
          prescriptions: [
            ...state.prescriptions,
            {
              ...prescription,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updatePrescription: (id, prescription) => {
        set((state) => ({
          prescriptions: state.prescriptions.map((p) =>
            p.id === id
              ? { ...p, ...prescription, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      // Lab Test operations
      addLabTest: (labTest) => {
        set((state) => ({
          labTests: [...state.labTests, labTest],
        }));
      },

      updateLabTest: (id, labTest) => {
        set((state) => ({
          labTests: state.labTests.map((t) =>
            t.id === id ? { ...t, ...labTest } : t
          ),
        }));
      },

      // Lab Order operations
      addLabOrder: (labOrder) => {
        set((state) => ({
          labOrders: [
            ...state.labOrders,
            {
              ...labOrder,
              id: labOrder.id ? String(labOrder.id) : generateId(),
              createdAt: (labOrder as any).createdAt ?? (labOrder as any).created_at ?? new Date().toISOString(),
              updatedAt: (labOrder as any).updatedAt ?? (labOrder as any).updated_at ?? (labOrder as any).createdAt ?? (labOrder as any).created_at ?? new Date().toISOString(),
            },
          ],
        }));
      },

      updateLabOrder: (id, labOrder) => {
        set((state) => ({
          labOrders: state.labOrders.map((o) =>
            o.id === id
              ? { ...o, ...labOrder, updatedAt: new Date().toISOString() }
              : o
          ),
        }));
      },

      deleteLabOrder: (id) => {
        set((state) => ({ labOrders: state.labOrders.filter((o) => o.id !== id) }));
      },

      // Lab Result operations
  addLabResult: (labResult) => {
        set((state) => ({
          labResults: [...state.labResults, labResult],
        }));
      },

      deleteLabResult: (id) => {
        set((state) => ({
          labResults: state.labResults.filter((r) => r.id !== id),
        }));
      },

      updateLabResult: (id, labResult) => {
        set((state) => ({
          labResults: state.labResults.map((r) =>
            r.id === id ? { ...r, ...labResult } : r
          ),
        }));
      },

      // Sales operations
      addSale: (sale) => {
        set((state) => ({
          sales: [
            ...state.sales,
            {
              ...sale,
              id: generateId(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }));
      },

      updateSale: (id, sale) => {
        set((state) => ({
          sales: state.sales.map((s) =>
            s.id === id
              ? { ...s, ...sale, updatedAt: new Date().toISOString() }
              : s
          ),
        }));
      },
    }),
    {
      name: 'hospital-storage',
    }
  )
);