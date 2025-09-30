import api from './apiClient';

// API-level representation of a LabOrder as returned by the server's LabOrderSerializer
export interface ApiLabOrder {
  id: number;
  // the serializer may include patient as id or as nested patient object
  patient: number | { id?: number; first_name?: string; last_name?: string; } | string;
  patient_name?: string | null;
  doctor?: number | { id?: number; name?: string } | null;
  doctor_name?: string | null;
  tests?: string [];
  status?: string | null;
}

export interface LabResult {
  id: number;
  // server returns nested LabOrder object for lab_order (read) but expects an ID on write
  lab_order: ApiLabOrder | number;
  result: string[];
  created_at: string;
}

// Simplified shape the UI needs: only the result, the lab-order name and the patient name
export interface SimplifiedLabResult {
  id: number;
  // result is stored as an array of strings on the server (e.g. ["eosinophils","brucella","wbc"])
  result: string[] | null;
  labOrderName: string | null; // inferred from lab_order.tests (see assumptions below)
  labOrderId?: number | null;
  labOrderTests?: string[] | string | null;
  patientName: string | null;
  // creation timestamp from backend (ISO string)
  created_at?: string | null;
}

// Map a raw LabResult (server payload) to the simplified shape used by the UI.
// Assumptions: "name of lab order" is taken from `lab_order.tests` when available;
// if `tests` is not present, we fall back to `doctor_name` or the lab_order id as a string.
export function simplifyLabResult(lr: LabResult): SimplifiedLabResult {
  const labOrder = typeof lr.lab_order === 'object' && lr.lab_order ? lr.lab_order as ApiLabOrder : null;
  let labOrderName: string | null = null;
  let labOrderTests: string[] | string | null = null;

  if (labOrder) {
    if (labOrder.tests) {
      // tests can be string or array; normalize to string
      if (Array.isArray(labOrder.tests)) {
        labOrderTests = labOrder.tests;
        labOrderName = labOrder.tests.join(', ');
      } else if (typeof labOrder.tests === 'string') {
        // try parse JSON string for an array, otherwise split by comma
        try {
          const parsed = JSON.parse(labOrder.tests as string);
          if (Array.isArray(parsed)) {
            labOrderTests = parsed;
            labOrderName = parsed.join(', ');
          } else {
            labOrderTests = String(parsed);
            labOrderName = String(parsed);
          }
        } catch (e) {
          const parts = String(labOrder.tests).split(',').map(s => s.trim()).filter(Boolean);
          labOrderTests = parts;
          labOrderName = parts.join(', ');
        }
      }
    } else if (labOrder.doctor_name) {
      labOrderName = labOrder.doctor_name;
    } else if (labOrder.id != null) {
      labOrderName = `Order #${labOrder.id}`;
    }
  }

  const patientName = labOrder && (labOrder.patient_name ?? null);

  return {
    id: lr.id,
    // ensure result is an array; if server unexpectedly returns a string, try to parse or split
    result: Array.isArray(lr.result)
      ? lr.result
      : (typeof lr.result === 'string'
        ? (() => {
            try {
              const parsed = JSON.parse(lr.result as unknown as string);
              return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
            } catch (e) {
              return String(lr.result).split(',').map(s => s.trim()).filter(Boolean);
            }
          })()
        : null),
    labOrderName,
    labOrderId: labOrder ? (labOrder.id ?? null) : null,
    labOrderTests: labOrderTests ?? null,
    patientName,
    created_at: (lr as any).created_at ?? (lr as any).createdAt ?? null,
  };
}

// payload to create/update a lab result — backend expects lab_order as an ID and result text
export interface LabResultCreatePayload {
  lab_order: number;
  result?: string[];
}

// Fetch all lab results (Read)
export async function fetchLabResults(): Promise<LabResult[]> {
  const response = await api.get<LabResult[]>(`lab-results/`);
  const data: any = response.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

// Convenience function: fetch lab results and return only the simplified fields the UI needs.
export async function fetchLabResultsSummary(): Promise<SimplifiedLabResult[]> {
  // Reuse fetchLabResults which already normalizes paginated responses to arrays
  const list = await fetchLabResults();
  return list.map(simplifyLabResult);
}

// Create a new lab result (Create)
export async function createLabResult(
  labResult: LabResultCreatePayload
): Promise<LabResult> {
  const response = await api.post<LabResult>(`lab-results/`, labResult);
  return response.data;
}

// Update an existing lab result (Update)
export async function updateLabResult(
  id: number,
  labResult: Partial<LabResultCreatePayload>
): Promise<LabResult> {
  const response = await api.put<LabResult>(`lab-results/${id}/`, labResult);
  return response.data;
}

// Delete a lab result (Delete)
export async function deleteLabResult(id: number): Promise<void> {
  await api.delete(`lab-results/${id}/`);
}

// Fetch a single lab result by ID
export async function fetchLabResultById(id: number): Promise<LabResult> {
  const response = await api.get<LabResult>(`lab-results/${id}/`);
  return response.data;
}

// Fetch a single lab result and return the simplified summary object.
export async function fetchLabResultSummaryById(id: number): Promise<SimplifiedLabResult> {
  const response = await api.get<LabResult>(`lab-results/${id}/`);
  return simplifyLabResult(response.data);
}
