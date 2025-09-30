import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  fetchAppointments as apiFetchAppointments,
  createAppointment as apiCreateAppointment,
  updateAppointment as apiUpdateAppointment,
  deleteAppointment as apiDeleteAppointment,
} from '../Api/appointmentApi';
import { fetchPatients as apiFetchPatients, createPatient as apiCreatePatient, updatePatient as apiUpdatePatient, deletePatient as apiDeletePatient } from '../Api/patientsApi';
import { fetchUsers as apiFetchUsers } from '../Api/staffApi';
import { fetchMedicines as apiFetchMedicines } from '../Api/medicineApi';
import { fetchDiagnoses as apiFetchDiagnoses } from '../Api/diagnosisApi';
import { fetchLabOrders as apiFetchLabOrders } from '../Api/labOrdersApi';
import { fetchLabResults as apiFetchLabResults } from '../Api/labResultsApi';
import { fetchSales as apiFetchSales } from '../Api/salesApi';
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
  // Synchronize store from server (fetch all resources and replace local state)
  syncFromServer: () => Promise<void>;
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
        // Normalize incoming lab results so UI uses `values: string[]`
        const normalized = (labResults || []).map((r: any) => {
          let values: string[] = [];
          if (Array.isArray(r.values)) values = r.values.map(String);
          else if (Array.isArray(r.result)) values = r.result.map(String);
          else if (typeof r.result === 'string') {
            try {
              const parsed = JSON.parse(r.result);
              values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            } catch (e) {
              values = String(r.result).split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          } else if (typeof r.values === 'string') {
            try {
              const parsed = JSON.parse(r.values);
              values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            } catch (e) {
              values = String(r.values).split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }

          return {
            id: String(r.id),
            orderId: r.orderId ? String(r.orderId) : (r.labOrderId ? String(r.labOrderId) : ''),
            testId: r.testId ? String(r.testId) : (r.test_id ? String(r.test_id) : ''),
            values,
            unit: r.unit ?? '',
            normalRange: r.normalRange ?? '',
            status: (r.status as any) ?? 'normal',
            // notes removed from LabResult model
            technician: r.technician ?? '',
            reviewedBy: r.reviewedBy ?? r.reviewed_by ?? '',
            completedAt: r.completedAt ?? r.created_at ?? new Date().toISOString(),
            patientName: (r as any).patientName ?? (r as any).patient_name ?? '',
            testName: (r as any).testName ?? (r as any).test_name ?? '',
          } as any;
        });

        set(() => ({ labResults: normalized }));
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
            // notes removed from LabOrder model
            createdAt: o.created_at ?? (o as any).createdAt ?? new Date().toISOString(),
            updatedAt: o.updated_at ?? (o as any).updatedAt ?? new Date().toISOString(),
          } as any;
        });

        set(() => ({ labOrders: normalized }));
      },
      sales: [],

      // Patient operations
      setPatients: (patients) => {
        set(() => ({ patients }));
      },
      addPatient: async (patient) => {
        try {
          // map UI shape to API expected fields
          const payload: any = {
            first_name: (patient as any).firstName ?? (patient as any).first_name,
            last_name: (patient as any).lastName ?? (patient as any).last_name,
            email: (patient as any).email,
            phone: (patient as any).phone,
            date_of_birth: (patient as any).dateOfBirth ?? (patient as any).date_of_birth,
            gender: (patient as any).gender,
            address: (patient as any).address,
            emergency_contact_name: (patient as any).emergencyContact ?? (patient as any).emergency_contact_name,
            emergency_contact_phone: (patient as any).emergencyPhone ?? (patient as any).emergency_contact_phone,
            emergency_contact_relationship: (patient as any).emergencyRelationship ?? (patient as any).emergency_contact_relationship,
            medical_history: (patient as any).medicalHistory ?? null,
          };
          const resp = await apiCreatePatient(payload);
          const newPatient: Patient = {
            id: String(resp.id),
            firstName: resp.first_name ?? '',
            lastName: resp.last_name ?? '',
            email: resp.email ?? '',
            phone: resp.phone ?? '',
            dateOfBirth: resp.date_of_birth ?? '',
            gender: ((resp.gender as Patient['gender']) ?? 'other'),
            address: resp.address ?? '',
            emergencyContact: resp.emergency_contact_name ?? '',
            emergencyPhone: resp.emergency_contact_phone ?? '',
            emergencyRelationship: resp.emergency_contact_relationship ?? '',
            medicalHistory: resp.medical_history ?? undefined,
            paymentStatus: (resp as any).payment_status ?? 'not_paid',
            createdAt: resp.created_at ?? new Date().toISOString(),
            updatedAt: resp.updated_at ?? (resp as any).updatedAt ?? new Date().toISOString(),
          };

          set((state) => ({ patients: [...state.patients, newPatient] }));
        } catch (err) {
          console.error('Failed to create patient', err);
        }
      },

      updatePatient: async (id, patient) => {
        try {
          const idNum = Number(id);
          const payload: any = {};
          if ((patient as any).firstName) payload.first_name = (patient as any).firstName;
          if ((patient as any).lastName) payload.last_name = (patient as any).lastName;
          if ((patient as any).email) payload.email = (patient as any).email;
          if ((patient as any).phone) payload.phone = (patient as any).phone;
          if ((patient as any).dateOfBirth) payload.date_of_birth = (patient as any).dateOfBirth;
          if ((patient as any).gender) payload.gender = (patient as any).gender;
          if ((patient as any).address) payload.address = (patient as any).address;
          if ((patient as any).medicalHistory) payload.medical_history = (patient as any).medicalHistory;

          const resp = await apiUpdatePatient(idNum, payload);
          set((state) => ({
            patients: state.patients.map((p) =>
              p.id === String(resp.id)
                ? {
                    ...p,
                    firstName: resp.first_name ?? p.firstName,
                    lastName: resp.last_name ?? p.lastName,
                    email: resp.email ?? p.email,
                    phone: resp.phone ?? p.phone,
                    dateOfBirth: resp.date_of_birth ?? p.dateOfBirth,
                    gender: ((resp.gender as Patient['gender']) ?? p.gender),
                    address: resp.address ?? p.address,
                    emergencyContact: resp.emergency_contact_name ?? p.emergencyContact,
                    emergencyPhone: resp.emergency_contact_phone ?? p.emergencyPhone,
                    emergencyRelationship: resp.emergency_contact_relationship ?? p.emergencyRelationship,
                    medicalHistory: resp.medical_history ?? p.medicalHistory,
                    updatedAt: resp.updated_at ?? new Date().toISOString(),
                  }
                : p
            ),
          }));
        } catch (err) {
          console.error('Failed to update patient', err);
        }
      },

      deletePatient: async (id) => {
        try {
          const idNum = Number(id);
          await apiDeletePatient(idNum);
          set((state) => ({ patients: state.patients.filter((p) => p.id !== id) }));
        } catch (err) {
          console.error('Failed to delete patient', err);
        }
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
            String(s.id) === String(id)
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
            String(d.id) === String(id)
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
            String(m.id) === String(id)
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
            String(p.id) === String(id)
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
            String(t.id) === String(id) ? { ...t, ...labTest } : t
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
            String(o.id) === String(id)
              ? { ...o, ...labOrder, updatedAt: new Date().toISOString() }
              : o
          ),
        }));
      },

      deleteLabOrder: (id) => {
        set((state) => ({ labOrders: state.labOrders.filter((o) => String(o.id) !== String(id)) }));
      },

      // Lab Result operations
  addLabResult: (labResult) => {
        const toAdd: any = { ...labResult };
        toAdd.id = String((labResult as any).id ?? generateId());
        if (Array.isArray(toAdd.values)) toAdd.values = toAdd.values.map(String);
        else if (Array.isArray((labResult as any).value)) toAdd.values = (labResult as any).value.map(String);
        else if (typeof toAdd.value === 'string') toAdd.values = String(toAdd.value).split(',').map((s: string) => s.trim()).filter(Boolean);
        else toAdd.values = toAdd.values ? [String(toAdd.values)] : [];

        set((state) => ({ labResults: [...state.labResults, toAdd] }));
      },

      deleteLabResult: (id) => {
        set((state) => ({
          labResults: state.labResults.filter((r) => String(r.id) !== String(id)),
        }));
      },

      updateLabResult: (id, labResult) => {
        set((state) => ({
          labResults: state.labResults.map((r) =>
            String(r.id) === String(id) ? { ...r, ...labResult } : r
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
      // Fetch many resources from server and replace local state so different devices/browsers see same data
      syncFromServer: async () => {
        try {
          // Fetch in parallel
          const [patients, users, medicines, diagnoses, labOrders, labResults, sales, appointments] = await Promise.all([
            apiFetchPatients().catch((e) => {
              console.warn('fetchPatients failed', e);
              return [] as any;
            }),
            apiFetchUsers().catch((e) => {
              console.warn('fetchUsers failed', e);
              return [] as any;
            }),
            apiFetchMedicines().catch((e) => {
              console.warn('fetchMedicines failed', e);
              return [] as any;
            }),
            apiFetchDiagnoses().catch((e) => {
              console.warn('fetchDiagnoses failed', e);
              return [] as any;
            }),
            apiFetchLabOrders().catch((e) => {
              console.warn('fetchLabOrders failed', e);
              return [] as any;
            }),
            apiFetchLabResults().catch((e) => {
              console.warn('fetchLabResults failed', e);
              return [] as any;
            }),
            apiFetchSales().catch((e) => {
              console.warn('fetchSales failed', e);
              return [] as any;
            }),
            apiFetchAppointments().catch((e) => {
              console.warn('fetchAppointments failed', e);
              return [] as any;
            }),
          ]);

          // Normalize and set the state pieces we support
          const normalizedPatients = (patients || []).map((p: any) => ({
            id: String(p.id),
            firstName: p.first_name ?? p.firstName ?? '',
            lastName: p.last_name ?? p.lastName ?? '',
            email: p.email ?? '',
            phone: p.phone ?? '',
            dateOfBirth: p.date_of_birth ?? p.dateOfBirth ?? '',
            gender: (p.gender as any) ?? 'other',
            address: p.address ?? '',
            emergencyContact: p.emergency_contact_name ?? p.emergencyContact ?? '',
            emergencyPhone: p.emergency_contact_phone ?? p.emergencyPhone ?? '',
            emergencyRelationship: p.emergency_contact_relationship ?? p.emergencyRelationship ?? '',
            medicalHistory: p.medical_history ?? null,
            paymentStatus: p.payment_status ?? p.paymentStatus ?? 'not_paid',
            createdAt: p.created_at ?? (p as any).createdAt ?? new Date().toISOString(),
            updatedAt: p.updated_at ?? (p as any).updatedAt ?? new Date().toISOString(),
          } as any));

          const normalizedStaff = (users || []).map((u: any) => ({
            id: String(u.id),
            name: u.name ?? u.username ?? '',
            email: u.email ?? '',
            role: (u.role ?? u.groups ?? u.is_staff) ? (u.role ?? (u.is_staff ? 'staff' : '')) : '',
            specialization: u.specialization ?? null,
            phone: u.phone ?? null,
            address: u.address ?? null,
            createdAt: u.created_at ?? u.createdAt ?? new Date().toISOString(),
            updatedAt: u.updated_at ?? u.updatedAt ?? new Date().toISOString(),
          } as any));

          const normalizedMedicines = (medicines || []).map((m: any) => ({
            id: String(m.id),
            name: m.name,
            category: m.category,
            description: m.description,
            stock: m.stock,
            price: String(m.price ?? m.unit_price ?? ''),
            createdAt: m.created_at ?? m.createdAt ?? new Date().toISOString(),
            updatedAt: m.updated_at ?? m.updatedAt ?? new Date().toISOString(),
          } as any));

          const normalizedDiagnoses = (diagnoses || []).map((d: any) => ({
            id: String(d.id),
            patientId: String(d.patient ?? d.patient_id ?? ''),
            doctorId: String(d.doctor ?? d.doctor_id ?? ''),
            summary: d.summary ?? d.description ?? '',
            createdAt: d.created_at ?? d.createdAt ?? new Date().toISOString(),
            updatedAt: d.updated_at ?? d.updatedAt ?? new Date().toISOString(),
          } as any));

          const normalizedLabOrders = (labOrders || []).map((o: any) => {
            const patientId = o.patient ?? (o.patient?.id ? String(o.patient.id) : '') ?? '';
            const doctorId = o.doctor ?? (o.doctor?.id ? String(o.doctor.id) : null) ?? null;
            const testIds = o.tests ?? o.testIds ?? [];
            return {
              id: String(o.id),
              patientId: String(patientId),
              doctorId: doctorId ? String(doctorId) : '',
              testIds: typeof testIds === 'string' ? testIds.split(',').map((s: string) => s.trim()) : testIds,
              status: o.status ?? 'pending',
              priority: o.priority ?? 'routine',
              orderDate: o.created_at ?? o.order_date ?? new Date().toISOString(),
              // notes removed from LabOrder model
              createdAt: o.created_at ?? new Date().toISOString(),
              updatedAt: o.updated_at ?? new Date().toISOString(),
            } as any;
          });

          const normalizedLabResults = (labResults || []).map((r: any) => {
            let values: string[] = [];
            if (Array.isArray(r.values)) values = r.values.map(String);
            else if (Array.isArray(r.result)) values = r.result.map(String);
            else if (typeof r.result === 'string') {
              try {
                const parsed = JSON.parse(r.result);
                values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
              } catch (e) {
                values = String(r.result).split(',').map((s: string) => s.trim()).filter(Boolean);
              }
            }

            return {
              id: String(r.id),
              labOrderId: r.lab_order?.id ?? r.lab_order ?? null,
              values,
              createdAt: r.created_at ?? new Date().toISOString(),
              updatedAt: r.updated_at ?? r.updatedAt ?? new Date().toISOString(),
            } as any;
          });

          const normalizedSales = (sales || []).map((s: any) => ({
            id: String(s.id),
            items: s.items ?? s.line_items ?? [],
            total: Number(s.total ?? s.amount ?? 0),
            saleType: s.sale_type ?? s.type ?? null,
            createdAt: s.created_at ?? new Date().toISOString(),
            updatedAt: s.updated_at ?? new Date().toISOString(),
          } as any));

          // appointments already mapped by existing fetcher but ensure string ids
          const normalizedAppointments = (appointments || []).map((a: any) => {
            const d = new Date(a.date);
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return {
              id: String(a.id),
              patientId: String(a.patient ?? a.patient_id ?? ''),
              doctorId: String(a.doctor ?? a.doctor_id ?? ''),
              date: d.toISOString().split('T')[0],
              time: `${hh}:${mm}`,
              duration: a.duration ?? 30,
              type: a.type ?? 'consultation',
              reason: a.reason ?? '',
              status: a.status === 'canceled' ? 'cancelled' : (a.status ?? 'scheduled'),
              paymentStatus: (a as any).payment_status ?? 'not_paid',
              createdAt: d.toISOString(),
              updatedAt: d.toISOString(),
            } as Appointment;
          });

          set(() => ({
            patients: normalizedPatients,
            staff: normalizedStaff,
            medicines: normalizedMedicines,
            diagnoses: normalizedDiagnoses,
            labOrders: normalizedLabOrders,
            labResults: normalizedLabResults,
            sales: normalizedSales,
            appointments: normalizedAppointments,
          }));
        } catch (err) {
          console.error('syncFromServer failed', err);
        }
      },
    }),
    {
      name: 'hospital-storage',
    }
  )
);