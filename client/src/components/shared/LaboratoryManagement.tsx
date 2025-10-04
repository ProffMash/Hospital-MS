import React, { useState, useMemo, useEffect } from 'react';
import { isRole } from '../../utils/roleUtils';
import { Plus, Search, Edit, Download, Clock, CheckCircle, User, Trash2 } from 'lucide-react';
import { formatPersonName } from '../../utils/formatUtils';
import { createLabOrder as apiCreateLabOrder, updateLabOrder as apiUpdateLabOrder, fetchLabOrders as apiFetchLabOrders, deleteLabOrder as apiDeleteLabOrder } from '../../Api/labOrdersApi';
import {
  fetchLabResultsSummary as apiFetchLabResultsSummary,
  createLabResult as apiCreateLabResult,
  updateLabResult as apiUpdateLabResult,
  deleteLabResult as apiDeleteLabResult,
} from '../../Api/labResultsApi';
import { useHospitalStore } from '../../store/hospitalStore';
import { useAuthStore } from '../../store/authStore';
import type { LabOrder, LabResult } from '../../types';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import LabOrderInputModal from './LabOrderInputModal';
import { Select } from '../UI/Select';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils';

export const Laboratory: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    labOrders, 
    labTests, 
    labResults,
    patients, 
    staff,
    addLabOrder,
    updateLabOrder,
    addLabResult,
    updateLabResult,
    setLabOrders,
    setLabResults,
    deleteLabOrder,
    deleteLabResult
  } = useHospitalStore();
  
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'orders' | 'results'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'order' | 'result'>('order');
  const [editingItem, setEditingItem] = useState<any>(null);
  // two-step flow: after selecting categories within the order modal, show input modal for details
  const [showInputModal, setShowInputModal] = useState(false);
  const [inputModalTests, setInputModalTests] = useState<string[]>([]);
  const [inputModalMode, setInputModalMode] = useState<'order' | 'result'>('order');
  
  const defaultSelectedTests = {
    // Hematology
    hemoglobin: false,
    hematocrit: false,
    platelet: false,
    neutrophils: false,
    lymphocytes: false,
    monocytes: false,
    eosinophils: false,
    basophils: false,
    malariaBloodSmear: false,
    bloodGrouping: false,

    // Biochemistry
    glucose: false,
    creatinine: false,
    bilirubin: false,
    cholesterol: false,
    sgot: false,
    sputum: false,

    // Serology
    psa: false,
    lipidProfile: false,
    parathyroid: false,
    brucella: false,
    vdrlTest: false,
    proteinC: false,
    toxoplasmosis: false,
    typhoid: false,
    hepatitisB: false,
    asg: false,

    // Urinalysis
    leukocytes: false,
    nitrite: false,
    bilirubin_urine: false,
    ketone: false,

    // Microscopy
    wbc: false,
    crystals: false,
    parasites: false,

    // Stool Examination
    histolytic: false,
    trichurus: false,
    ecoli: false,
    ent: false,
    chlamydia: false,
    ascaris: false,
    giardia: false,
    strongyloides: false,
    trichomonad: false,
    other_stool: false
  } as Record<string, boolean>;

  const [orderFormData, setOrderFormData] = useState({
    patientId: '',
    doctorId: '',
    selectedTests: { ...defaultSelectedTests },
    priority: '',
    status: 'pending',
    patientName: '',
    notes: ''
  });



  const [resultFormData, setResultFormData] = useState({
    orderId: '',
    patientId: '',
    values: [] as string[],
    testId: '',
    status: '',
    technician: '',
    notes: ''
  });

  // Helper to normalize various server/legacy shapes into string[] for `values`
  const normalizeToArray = (raw: any): string[] => {
    if (!raw && raw !== 0) return [];
    if (Array.isArray(raw)) return raw.map(String);
    if (typeof raw === 'string') {
      // Try JSON parse first (server might return JSON string)
      try {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) return p.map(String);
        return [String(p)];
      } catch (e) {
        return String(raw).split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    return [String(raw)];
  };

  // Helper to pair values with tests when possible: tests can be an array of names or ids
  const normalizePairs = (values: any, tests: any): { testName: string; value: string }[] => {
    const vals = normalizeToArray(values);
    if (!tests) {
      // create generic pairs with unnamed tests
      return vals.map(v => ({ testName: '', value: v }));
    }
    let testNames: string[] = [];
    if (Array.isArray(tests)) testNames = tests.map(String);
    else if (typeof tests === 'string') {
      try {
        const p = JSON.parse(tests);
        if (Array.isArray(p)) testNames = p.map(String);
        else testNames = [String(p)];
      } catch (e) {
        testNames = String(tests).split(',').map((s:string) => s.trim()).filter(Boolean);
      }
    } else {
      testNames = [String(tests)];
    }

    if (testNames.length && testNames.length === vals.length) {
      return vals.map((v, i) => ({ testName: testNames[i], value: v }));
    }

    // If lengths don't match, try to attach first test name to first value and leave rest unnamed
    return vals.map((v, i) => ({ testName: testNames[i] ?? '', value: v }));
  };

  // Helper to build aligned Tests and Results strings for an order (used for exports)
  const formatOrderTestsAndResults = (order: any) => {
    const rawTests: any[] = (order.testIds && Array.isArray(order.testIds) && order.testIds.length)
      ? order.testIds
      : (order.tests && Array.isArray(order.tests) && order.tests.length)
        ? order.tests
        : (order.testDetails && Array.isArray(order.testDetails) ? order.testDetails.map((d:any) => d.key || d.name || d) : []);

    const testNames: string[] = (rawTests || []).map((t: any) => {
      const tid = String(t);
      const found = labTests.find(lt => String(lt.id) === tid || String(lt.name) === tid);
      if (found) return found.name;
      if (t && typeof t === 'object') return t.name || t.key || String(t);
      return tid;
    }).filter(Boolean) as string[];

    // collect results for this order and attempt to align them to testNames
    const orderResults = (labResults || []).filter((r:any) => String(r.orderId) === String(order.id));
    const resultMap = new Map<string, string[]>();
    orderResults.forEach((res: any) => {
      if (res.pairs && Array.isArray(res.pairs) && res.pairs.length) {
        res.pairs.forEach((p: any, idx: number) => {
          const name = (p.testName && String(p.testName)) || testNames[idx] || '';
          if (!name) return;
          const arr = resultMap.get(name) || [];
          arr.push(String(p.value ?? ''));
          resultMap.set(name, arr);
        });
      } else if (Array.isArray(res.values) && res.values.length) {
        if (testNames.length === res.values.length) {
          res.values.forEach((v: any, idx: number) => {
            const name = testNames[idx] || `Test ${idx+1}`;
            const arr = resultMap.get(name) || [];
            arr.push(String(v ?? ''));
            resultMap.set(name, arr);
          });
        } else {
          const arr = resultMap.get('__other__') || [];
          arr.push(res.values.join(', '));
          resultMap.set('__other__', arr);
        }
      } else if (res.value) {
        const arr = resultMap.get('__other__') || [];
        arr.push(String(res.value));
        resultMap.set('__other__', arr);
      }
    });

  const testsString = testNames.join('\n') || (order.tests || '—');
    const resultsParts: string[] = [];
    if (testNames.length) {
      testNames.forEach(name => {
        const vals = resultMap.get(name);
        if (vals && vals.length) resultsParts.push(`${name}: ${vals.join(', ')}`);
        else resultsParts.push(`${name}: `);
      });
    }
    if (resultMap.has('__other__')) {
      resultsParts.push(`Other: ${(resultMap.get('__other__') || []).join(' | ')}`);
    }

    const resultsString = resultsParts.filter(Boolean).join(' | ') || '—';
    return { testsString, resultsString };
  };

  const filteredOrders = useMemo(() => {
    const normalizedLabOrders = labOrders.map((o: any) => {
      const patientId = o.patientId ?? (o.patient ? String(o.patient) : '');
      const doctorId = o.doctorId ?? (o.doctor ? String(o.doctor) : '');
      const testIds = o.testIds ?? (o.tests ? (typeof o.tests === 'string' ? o.tests.split(',').map((s: string) => s.trim()) : o.tests) : []);
      const orderDate = o.orderDate ?? o.created_at ?? new Date().toISOString();
      return { ...o, patientId, doctorId, testIds, orderDate } as any;
    });

    return normalizedLabOrders.filter(order => {
      const patient = patients.find(p => p.id === order.patientId);
      const doctor = staff.find(s => s.id === order.doctorId);

      const patientName = patient ? `${patient.firstName} ${patient.lastName}` : ((order as any).patient_name || '');
      const doctorName = doctor ? `${doctor.firstName} ${doctor.lastName}` : ((order as any).doctor_name || '');

      const lowerSearch = (searchTerm || '').toLowerCase();
      const matchesSearch = (
        (patientName || '').toLowerCase().includes(lowerSearch) ||
        (doctorName || '').toLowerCase().includes(lowerSearch)
      );

      const matchesStatus = !filterStatus || order.status === filterStatus;
      const matchesDoctor = !isRole(user, 'doctor') || order.doctorId === user?.id || (order.doctor && String(order.doctor) === user?.id);

      return matchesSearch && matchesStatus && matchesDoctor;
    });
  }, [labOrders, patients, staff, searchTerm, filterStatus, user]);

  const filteredResults = useMemo(() => {
    const lowerSearch = (searchTerm || '').toLowerCase();
    return labResults.filter(result => {
      const test = labTests.find(t => t.id === result.testId);
      const testName = test?.name ?? (result as any).testName ?? '';
      const technician = (result.technician ?? '') as string;

      return (testName.toLowerCase().includes(lowerSearch)) ||
             (technician.toLowerCase().includes(lowerSearch));
    });
  }, [labResults, labOrders, labTests, searchTerm]);

  const doctors = staff.filter(s => s.role === 'doctor');

  // group results by patientName (or order -> patient) so the results table can show one row per patient
  const groupedResults = useMemo(() => {
    const map = new Map<string, { patientName: string; items: any[] }>();
    filteredResults.forEach((r: any) => {
      // resolve patient name: prefer server-provided patientName, otherwise resolve from order -> patient store
      let patientName = (r as any).patientName || '';
      if (!patientName) {
        const order = labOrders.find(o => String(o.id) === String(r.orderId));
        if (order) {
          // try to resolve patient from patients store via order.patientId first
          const pid = (order as any).patientId ?? (order as any).patient ?? '';
          const patientObj = patients.find(p => String(p.id) === String(pid));
          if (patientObj) {
            patientName = `${patientObj.firstName} ${patientObj.lastName}`;
          } else {
            patientName = (order as any).patientName ?? (order as any).patient_name ?? '';
          }
        }
      }
      if (!patientName) patientName = 'Unknown';

      const key = patientName || String(r.orderId) || 'Unknown';
  const entry = map.get(key) || { patientName: patientName || 'Unknown', items: [] as any[] };
  // compute pairs of testName -> value for this result record
  const order = labOrders.find(o => String(o.id) === String(r.orderId));
  const orderTests = order ? (order.testIds ?? null) : null;
  const testNameFromResult = (r as any).testName || (labTests.find(t => t.id === r.testId) || {}).name || '';
  const pairs = (r as any).pairs ? (r as any).pairs : normalizePairs((r as any).values ?? (r as any).result, orderTests ?? (testNameFromResult ? [testNameFromResult] : null));
  const enriched = { ...(r as any), pairs };
  entry.items.push(enriched);
      map.set(key, entry);
    });

    return Array.from(map.entries()).map(([key, group], idx) => ({
      id: `group-${idx}-${key}`,
      patientName: group.patientName,
  // combine tests and values into a compact string (show pairings)
  testsDisplay: group.items.map((it: any) => (it.pairs || []).map((p: any) => `${p.testName || it.testName || labTests.find((t:any) => t.id === it.testId)?.name || 'Test'}: ${p.value}`).join('\n')).join(' | '),
      latestDate: group.items.reduce((d: string | null, it: any) => {
        return it.completedAt && (!d || new Date(it.completedAt) > new Date(d)) ? it.completedAt : d;
      }, null as any) || '',
      items: group.items
    }));
  }, [filteredResults, labOrders, labTests]);

  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupModalItems, setGroupModalItems] = useState<any[]>([]);
  const [editingPairIndex, setEditingPairIndex] = useState<number | null>(null);
  const [editingPairValue, setEditingPairValue] = useState<string>('');
  const [editingValues, setEditingValues] = useState<string[] | null>(null);

  const handleOpenModal = (type: 'order' | 'test' | 'result', item?: any) => {
    // accept only 'order' or 'result' now
    setModalType(type as any);
    setEditingItem(item);
    
    if (type === 'order') {
      if (item) {
        // If the existing order stores testIds (array), convert to selectedTests map
        let selected = { ...defaultSelectedTests };
        if (item.selectedTests && Object.keys(item.selectedTests).length > 0) {
          selected = { ...selected, ...item.selectedTests };
        } else if (item.testIds && Array.isArray(item.testIds)) {
          item.testIds.forEach((tid: string) => {
            // try to find a test by id and use its key (name or id) to mark selected
            const t = labTests.find(t => t.id === tid);
            if (t) {
              // mark by test.name key if it exists in selected, otherwise mark by id
              const key = t.id in selected ? t.id : (t.name.replace(/\s+/g, '') in selected ? t.name.replace(/\s+/g, '') : tid);
              selected[key] = true;
            } else {
              selected[tid] = true;
            }
          });
        }

        setOrderFormData({
          patientId: item.patientId,
          doctorId: item.doctorId,
          selectedTests: selected,
          priority: item.priority,
          status: item.status ?? 'pending',
          notes: item.notes || '',
          patientName: ''
        });
      } else {
        setOrderFormData({
          patientId: '',
          doctorId: user?.role === 'doctor' ? user.id : '',
          selectedTests: { ...defaultSelectedTests },
          priority: '',
          status: 'pending',
          notes: '',
          patientName: ''
        });
      }
    } else if (type === 'result') {
      if (item) {
        setResultFormData({
          orderId: item.orderId,
          patientId: (item.patientId ?? '') as string,
          testId: item.testId,
          values: Array.isArray(item.values) ? item.values : (item.value ? [item.value] : []),
          status: item.status,
          notes: item.notes || '',
          technician: item.technician
        });
        // initialize editing values array from pairs/values for inline editing
        const initialValues = (item.pairs && Array.isArray(item.pairs) && item.pairs.length)
          ? item.pairs.map((p: any) => String(p.value ?? ''))
          : (Array.isArray(item.values) && item.values.length) ? [...item.values] : (item.value ? [String(item.value)] : []);
        setEditingPairIndex(initialValues.length ? 0 : null);
        setEditingPairValue(initialValues.length ? initialValues[0] : '');
        setEditingValues(initialValues.length ? initialValues : null);
      } else {
        setResultFormData({
          orderId: '',
          patientId: '',
          testId: '',
          values: [],
          status: '',
          notes: '',
          technician: user?.name || ''
        });
        setEditingPairIndex(null);
        setEditingPairValue('');
        setEditingValues(null);
      }
    }
    
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setEditingPairIndex(null);
    setEditingPairValue('');
    setEditingValues(null);
  };
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (modalType === 'order') {
      // Convert selected tests to testIds array for compatibility (map keys/names to actual labTests ids when possible)
      const rawTestKeys = Object.entries(orderFormData.selectedTests)
        .filter(([_, selected]) => selected)
        .map(([testName, _]) => testName);
      const testIds = rawTestKeys.map(k => {
        const found = labTests.find(t => String(t.id) === String(k) || t.name === k || (t.name && t.name.replace(/\s+/g, '') === k) );
        return found ? String(found.id) : String(k);
      });

      // If creating a new order (not editing)
      if (!editingItem) {
        if (!orderFormData.patientId) {
          return alert('Please select a patient before creating an order.');
        }
        if (!testIds.length) {
          return alert('Please select at least one test.');
        }
        // Create order immediately (no separate input modal) — tests are taken from selected checkboxes
        const payload: any = {
          patient: Number(orderFormData.patientId),
          doctor: orderFormData.doctorId ? Number(orderFormData.doctorId) : null,
          // send tests as an array of test ids/keys (backend may accept array or string; prefer array)
          tests: testIds,
          status: orderFormData.status || 'pending'
        };
        apiCreateLabOrder(payload as any)
          .then((resp) => {
            let createdTestIds: string[] = [];
            if (Array.isArray(resp.tests)) createdTestIds = resp.tests;
            else if (typeof resp.tests === 'string') createdTestIds = (resp.tests as string).split(',').map((t: string) => t.trim()).filter(Boolean);
            // derive readable names for patient/doctor when backend doesn't return them
            const localDoctorId = resp.doctor ? String(resp.doctor) : String(orderFormData.doctorId || '');
            const staffDoctor = staff.find(s => String(s.id) === localDoctorId);
            const doctorName = resp.doctor_name ?? (staffDoctor ? `${staffDoctor.firstName} ${staffDoctor.lastName}` : (user && user.role === 'doctor' ? formatPersonName(user, 'Dr.') : ''));
            const localPatientId = resp.patient ? String(resp.patient) : String(orderFormData.patientId || '');
            const patientObj = patients.find(p => String(p.id) === String(localPatientId));
            const patientName = resp.patient_name ?? (patientObj ? `${patientObj.firstName} ${patientObj.lastName}` : '');

            addLabOrder({
              id: resp.id ? String(resp.id) : Date.now().toString(),
              patientId: String(resp.patient ?? orderFormData.patientId),
              doctorId: localDoctorId,
              testIds: createdTestIds.length ? createdTestIds : testIds,
              status: resp.status as any || 'pending',
              orderDate: resp.created_at || new Date().toISOString(),
              // notes field removed from lab orders
              createdAt: resp.created_at || new Date().toISOString(),
              updatedAt: resp.created_at || new Date().toISOString(),
              doctorName,
              patientName,
            } as LabOrder);
          })
          .catch((err) => {
            console.error('Failed to create lab order', err);
            // fallback: create locally
            const fallbackDoctorId = orderFormData.doctorId || (user?.role === 'doctor' ? user.id : '');
            const staffDoctorFallback = staff.find(s => String(s.id) === String(fallbackDoctorId));
            const fallbackDoctorName = staffDoctorFallback ? `${staffDoctorFallback.firstName} ${staffDoctorFallback.lastName}` : (user && user.role === 'doctor' ? formatPersonName(user, 'Dr.') : '');
            const fallbackPatientObj = patients.find(p => String(p.id) === String(orderFormData.patientId));
            const fallbackPatientName = fallbackPatientObj ? `${fallbackPatientObj.firstName} ${fallbackPatientObj.lastName}` : '';
            addLabOrder({
              id: Date.now().toString(),
              patientId: orderFormData.patientId,
              doctorId: fallbackDoctorId,
              testIds,
              status: 'pending',
              orderDate: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              doctorName: fallbackDoctorName,
              patientName: fallbackPatientName,
            } as LabOrder);
          });
      } else {
        // editing existing order
        const resolvedIdKey = editingItem?.id ?? (editingItem as any)?.orderId ?? (editingItem as any)?.pk ?? '';
        if (!resolvedIdKey) {
          console.error('Cannot update lab order: invalid id', resolvedIdKey, editingItem);
        } else {
          const payload: any = {
            patient: Number(orderFormData.patientId),
            doctor: orderFormData.doctorId ? Number(orderFormData.doctorId) : null,
            // prefer sending array for tests (already converted to ids when possible)
            tests: testIds,
            status: orderFormData.status || editingItem.status || 'pending'
          };
          apiUpdateLabOrder(resolvedIdKey, payload as any)
            .then((resp) => {
              const localId = String(resolvedIdKey);
              updateLabOrder(localId, {
                patientId: String(resp.patient ?? orderFormData.patientId),
                doctorId: resp.doctor ? String(resp.doctor) : orderFormData.doctorId,
                testIds: resp.tests ? (Array.isArray(resp.tests) ? resp.tests : String(resp.tests).split(',').map((t: string) => t.trim())) : testIds,
                status: resp.status as any,
                orderDate: resp.created_at || new Date().toISOString(),
              });
            })
            .catch((err) => console.error('Failed to update lab order', err));
        }
      }
    } else if (modalType === 'result') {
      // Create or update a lab result
      const resultDataTemplate = {
        id: editingItem?.id || Date.now().toString(),
        orderId: resultFormData.orderId,
        values: resultFormData.values && resultFormData.values.length ? resultFormData.values : (editingItem?.values || (editingItem?.value ? [editingItem.value] : [])),
        completedAt: new Date().toISOString()
      } as any;

      if (editingItem) {
        // compute the result array to send: start from current form values or existing values, then apply single-pair edit if present
        const computedValuesForPayload = (resultFormData.values && resultFormData.values.length) ? [...resultFormData.values] : (editingItem?.values ? [...editingItem.values] : (editingItem?.value ? [editingItem.value] : []));
        if (editingPairIndex !== null && typeof editingPairIndex !== 'undefined') {
          while (computedValuesForPayload.length <= (editingPairIndex as number)) computedValuesForPayload.push('');
          computedValuesForPayload[editingPairIndex as number] = editingPairValue ?? computedValuesForPayload[editingPairIndex as number];
        }

        const payload: any = {
          lab_order: Number(resultFormData.orderId),
          result: computedValuesForPayload
        };

        // Optimistically update local store so UI doesn't show 'Unknown' while waiting for server
        try {
          const resolvedOrderIdLocal = resultFormData.orderId || editingItem.orderId || '';
          const orderLocal = labOrders.find((o) => String(o.id) === String(resolvedOrderIdLocal));
          const localTestId = resultFormData.testId || editingItem.testId || '';
          const localTestName = (labTests.find(t => t.id === localTestId)?.name) || (editingItem as any).testName || '';

          // Resolve patient name deterministically: prefer patients store via order.patientId, then order's patientName fields, then editingItem
          let localPatientName = '';
          if (orderLocal) {
            const patientIdFromOrder = (orderLocal as any).patientId ?? (orderLocal as any).patient ?? '';
            if (patientIdFromOrder) {
              const patientObj = patients.find(p => String(p.id) === String(patientIdFromOrder));
              if (patientObj) {
                localPatientName = `${patientObj.firstName} ${patientObj.lastName}`;
              } else {
                localPatientName = (orderLocal as any).patientName ?? (orderLocal as any).patient_name ?? '';
              }
            } else {
              localPatientName = (orderLocal as any).patientName ?? (orderLocal as any).patient_name ?? '';
            }
          } else if ((editingItem as any).patientId) {
            const patientFromEdit = patients.find(p => String(p.id) === String((editingItem as any).patientId));
            localPatientName = patientFromEdit ? `${patientFromEdit.firstName} ${patientFromEdit.lastName}` : ((editingItem as any).patientName || '');
          } else {
            localPatientName = (editingItem as any).patientName || '';
          }

          // ensure we don't clear an existing patientName — prefer editingItem.patientName or current store value
          if (!localPatientName) {
            // try to read current store value for this result
            const currentLocal = labResults.find((r: any) => String(r.id) === String(editingItem.id));
            localPatientName = (currentLocal as any)?.patientName || (editingItem as any).patientName || '';
          }

          const optimistic = {
            id: String(editingItem.id),
            orderId: String(resolvedOrderIdLocal || ''),
            testId: localTestId,
            testName: localTestName,
            patientName: localPatientName,
            values: computedValuesForPayload,
            completedAt: new Date().toISOString(),
          } as any;
          updateLabResult(String(editingItem.id), optimistic);
        } catch (e) {
          // swallow optimistic update errors
          console.error('Optimistic update failed', e);
        }

        apiUpdateLabResult(Number(editingItem.id), payload)
          .then((respAny: any) => {
            const resp = respAny as any;
            const resolvedOrderId = resp.lab_order ? String(resp.lab_order.id ?? resp.lab_order) : String(resp.lab_order ?? '');
            const matchingOrder = labOrders.find(o => String(o.id) === resolvedOrderId);
            // prefer a sensible patientName: server -> matchingOrder -> current local store -> editingItem
            const currentLocalAfter = labResults.find((r: any) => String(r.id) === String(editingItem.id));
              const normalized = {
              id: String(resp.id),
              orderId: resolvedOrderId,
              testId: (resp as any).test_id ? String((resp as any).test_id) : (resultFormData.testId || editingItem.testId || ''),
              testName: (resp as any).test_name || (resp as any).testIdName || (matchingOrder && Array.isArray(matchingOrder.testIds) && matchingOrder.testIds.length ? labTests.find(t => t.id === matchingOrder.testIds[0])?.name || '' : '') || (editingItem as any).testName || '',
              patientName: matchingOrder ? ((matchingOrder as any).patientName ?? (matchingOrder as any).patient_name ?? '') : ((resp as any).patientName ?? (currentLocalAfter as any)?.patientName ?? (editingItem as any).patientName ?? ''),
                values: normalizeToArray((resp as any).result ?? resultDataTemplate.values),
                pairs: normalizePairs((resp as any).result ?? resultDataTemplate.values, matchingOrder ? (matchingOrder.testIds ?? null) : ((resp as any).test_name ? [ (resp as any).test_name ] : null)),
              completedAt: (resp as any).created_at ?? resultDataTemplate.completedAt,
            } as any;
            updateLabResult(String(editingItem.id), normalized);
          })
          .catch((err) => {
            console.error('Failed to update lab result', err);
            // keep the optimistic update already applied
          });
      } else {
        const resolvedOrderIdNum = Number(resultFormData.orderId);
        const resultPayload: any = {
          lab_order: resolvedOrderIdNum,
          result: resultFormData.values && resultFormData.values.length ? resultFormData.values : ['']
        };
        if (!resultFormData.orderId || Number.isNaN(resolvedOrderIdNum) || resolvedOrderIdNum <= 0) {
          console.error('Cannot create lab result: invalid lab order id', resultFormData.orderId);
          addLabResult(resultDataTemplate as LabResult);
        } else {
          apiCreateLabResult(resultPayload)
            .then((respAny: any) => {
              const resp = respAny as any;
              const createdOrderId = resp.lab_order ? String(resp.lab_order.id ?? resp.lab_order) : String(resp.lab_order ?? '');
              const createdOrder = labOrders.find(o => String(o.id) === createdOrderId);
              const normalized = {
                id: String(resp.id),
                orderId: createdOrderId,
                testId: (resp as any).test_id ? String((resp as any).test_id) : '',
                testName: createdOrder && Array.isArray(createdOrder.testIds) && createdOrder.testIds.length ? labTests.find(t => t.id === createdOrder.testIds[0])?.name || '' : '',
                patientName: createdOrder ? ((createdOrder as any).patientName ?? (createdOrder as any).patient_name ?? '') : '',
                values: normalizeToArray((resp as any).result ?? resultDataTemplate.values),
                pairs: normalizePairs((resp as any).result ?? resultDataTemplate.values, createdOrder ? (createdOrder.testIds ?? null) : ((resp as any).test_name ? [ (resp as any).test_name ] : null)),
                completedAt: (resp as any).created_at ?? resultDataTemplate.completedAt,
              } as any;
              addLabResult(normalized as LabResult);
            })
            .catch((err) => {
              console.error('Failed to create lab result', err);
              addLabResult(resultDataTemplate as LabResult);
            });
        }
      }
    }

    // close modal after initiating requests
    handleCloseModal();
  };

  const handleExport = (format: 'csv' | 'pdf') => {
  let dataToExport: any[] = [];
    let filename = '';
    let title = '';
    
    if (activeTab === 'orders') {
      // helper to build aligned Tests and Results strings for an order
      const formatOrderTestsAndResults = (order: any) => {
        const rawTests: any[] = (order.testIds && Array.isArray(order.testIds) && order.testIds.length)
          ? order.testIds
          : (order.tests && Array.isArray(order.tests) && order.tests.length)
            ? order.tests
            : (order.testDetails && Array.isArray(order.testDetails) ? order.testDetails.map((d:any) => d.key || d.name || d) : []);

        const testNames: string[] = (rawTests || []).map((t: any) => {
          const tid = String(t);
          const found = labTests.find(lt => String(lt.id) === tid || String(lt.name) === tid);
          if (found) return found.name;
          if (t && typeof t === 'object') return t.name || t.key || String(t);
          return tid;
        }).filter(Boolean) as string[];

        // collect results for this order and attempt to align them to testNames
        const orderResults = (labResults || []).filter((r:any) => String(r.orderId) === String(order.id));
        const resultMap = new Map<string, string[]>();
        orderResults.forEach((res: any) => {
          if (res.pairs && Array.isArray(res.pairs) && res.pairs.length) {
            res.pairs.forEach((p: any, idx: number) => {
              const name = (p.testName && String(p.testName)) || testNames[idx] || '';
              if (!name) return;
              const arr = resultMap.get(name) || [];
              arr.push(String(p.value ?? ''));
              resultMap.set(name, arr);
            });
          } else if (Array.isArray(res.values) && res.values.length) {
            if (testNames.length === res.values.length) {
              res.values.forEach((v: any, idx: number) => {
                const name = testNames[idx] || `Test ${idx+1}`;
                const arr = resultMap.get(name) || [];
                arr.push(String(v ?? ''));
                resultMap.set(name, arr);
              });
            } else {
              const arr = resultMap.get('__other__') || [];
              arr.push(res.values.join(', '));
              resultMap.set('__other__', arr);
            }
          } else if (res.value) {
            const arr = resultMap.get('__other__') || [];
            arr.push(String(res.value));
            resultMap.set('__other__', arr);
          }
        });

  const testsString = testNames.join('\n') || (order.tests || '—');
        const resultsParts: string[] = [];
        if (testNames.length) {
          testNames.forEach(name => {
            const vals = resultMap.get(name);
            if (vals && vals.length) resultsParts.push(`${name}: ${vals.join(', ')}`);
            else resultsParts.push(`${name}: `);
          });
        }
        if (resultMap.has('__other__')) {
          resultsParts.push(`Other: ${(resultMap.get('__other__') || []).join(' | ')}`);
        }

        const resultsString = resultsParts.filter(Boolean).join(' | ') || '—';
        return { testsString, resultsString };
      };

      dataToExport = filteredOrders.map(order => {
        const patient = patients.find(p => p.id === order.patientId);
        const doctor = staff.find(s => s.id === order.doctorId);
        const { testsString } = formatOrderTestsAndResults(order);
        return {
          'Patient': patient ? `${patient.firstName} ${patient.lastName}` : ((order as any).patient_name || 'Unknown'),
          'Doctor': doctor ? formatPersonName(doctor, 'Dr.') : ((order as any).doctor_name || 'Unknown'),
          'Tests': testsString,
          'Status': order.status,
          'Order Date': formatDate(order.orderDate)
        };
      });
      filename = 'lab-orders-report';
      title = 'Lab Orders Report';
    } else if (activeTab === 'results') {
      dataToExport = filteredResults.map(result => {
        const order = labOrders.find(o => o.id === result.orderId);
        const patient = order ? patients.find(p => p.id === order.patientId) : null;
        return {
          'Patient': (result as any).patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'),
    'Result': (result as any).pairs && (result as any).pairs.length ? (result as any).pairs.map((p: any) => `${p.testName || ''}: ${p.value}`).join('\n') : (Array.isArray((result as any).values) ? (result as any).values.join(', ') : (result as any).value || ''),
          'Status': result.status,
          'Date': formatDate(result.completedAt)
        };
      });
      filename = 'lab-results-report';
      title = 'Lab Results Report';
    }
    exportData(dataToExport, filename, format, title);
  };

  // Export a single lab order as PDF
  const handleExportOrder = (order: any) => {
    const patient = patients.find(p => p.id === order.patientId);
    const doctor = staff.find(s => s.id === order.doctorId);
    const { testsString: testsSingle } = formatOrderTestsAndResults(order);

    const dataToExport = [
      {
        'Patient': patient ? `${patient.firstName} ${patient.lastName}` : ((order as any).patient_name || 'Unknown'),
        'Doctor': doctor ? formatPersonName(doctor, 'Dr.') : ((order as any).doctor_name || 'Unknown'),
        'Tests': testsSingle || (order.tests || '—'),
        'Status': order.status,
        'Order Date': formatDate(order.orderDate)
      }
    ];
    exportData(dataToExport, `lab-order-${order.id}`, 'pdf', `Lab Order — ${patient ? `${patient.firstName} ${patient.lastName}` : order.id}`);
  };

  const handleDeleteOrder = (id: string) => {
    if (!confirm('Delete this lab order? This action cannot be undone.')) return;
    // remove locally first
    deleteLabOrder(id);

    const idNum = Number(id);
    if (!id || Number.isNaN(idNum) || idNum <= 0) {
      // local-only order, nothing to delete on server
      return;
    }

    apiDeleteLabOrder(idNum).catch((err) => {
      console.error('Failed to delete lab order on server', err);
      apiFetchLabOrders()
        .then((data) => setLabOrders(data as any))
        .catch(() => {
          // swallow secondary error
        });
    });
  };

  const handleDeleteResult = (id: string) => {
    // optimistic UI: remove locally then call API
    deleteLabResult(id);
    const idNum = Number(id);
    if (!id || Number.isNaN(idNum) || idNum <= 0) {
      // local-only result, no server call
      return;
    }

    apiDeleteLabResult(idNum)
      .catch((err) => {
        console.error('Failed to delete lab result on server', err);
        // try to recover by refetching results summary
        apiFetchLabResultsSummary()
          .then((data) => {
            const normalizedResults = (data || []).map((r: any) => ({
              id: String(r.id),
              orderId: r.labOrderId ? String(r.labOrderId) : '',
              testId: '',
              testName: (Array.isArray(r.labOrderTests) && r.labOrderTests[0]) ? String(r.labOrderTests[0]) : (r.labOrderName ?? ''),
              patientName: r.patientName ?? '',
              values: Array.isArray(r.result) ? r.result : (typeof r.result === 'string' ? (function(){ try{ const p=JSON.parse(r.result); return Array.isArray(p)?p:[String(p)]; }catch(e){ return String(r.result).split(',').map((s:string)=>s.trim()).filter(Boolean); } })() : []),
              unit: '',
              normalRange: '',
              status: 'normal',
              notes: '',
              technician: '',
              reviewedBy: '',
              completedAt: (r && (r.created_at ?? r.createdAt)) ? (r.created_at ?? r.createdAt) : new Date().toISOString(),
            }));
            setLabResults(normalizedResults as any);
          })
          .catch(() => {
            // swallow secondary error
          });
      });

  };

  // Helper used by LabOrderInputModal to finalize creation
  const createOrderFromInput = (payload: { patientId: string; doctorId?: string; tests: string[]; priority?: string; notes?: string; status?: string; testDetails?: any[] }) => {
    const testIdsRaw = payload.tests || [];
    const testIds = testIdsRaw.map(k => {
      const found = labTests.find(t => String(t.id) === String(k) || t.name === k || (t.name && t.name.replace(/\s+/g, '') === k));
      return found ? String(found.id) : String(k);
    });

    const apiPayload: any = {
      patient: Number(payload.patientId),
      doctor: payload.doctorId ? Number(payload.doctorId) : null,
      // send tests as array of ids/keys
      tests: testIds,
      status: payload.status || payload.priority || 'pending'
    } as any;

    // include structured test details when available (sent as JSON string to backend if it understands it)
    if (payload.testDetails) {
      try {
        apiPayload.test_details = JSON.stringify(payload.testDetails);
      } catch (e) {
        apiPayload.test_details = String(payload.testDetails);
      }
    }

    apiCreateLabOrder(apiPayload as any)
      .then((resp) => {
  let createdTestIds: string[] = [];
  if (Array.isArray(resp.tests)) createdTestIds = resp.tests;
  else if (typeof resp.tests === 'string') createdTestIds = (resp.tests as string).split(',').map((t: string) => t.trim()).filter(Boolean);
        const localDoctorId2 = resp.doctor ? String(resp.doctor) : String(payload.doctorId || '');
        const staffDoctor2 = staff.find(s => String(s.id) === localDoctorId2);
        const doctorName2 = resp.doctor_name ?? (staffDoctor2 ? `${staffDoctor2.firstName} ${staffDoctor2.lastName}` : (user && user.role === 'doctor' ? formatPersonName(user, 'Dr.') : ''));
        const localPatientId2 = resp.patient ? String(resp.patient) : String(payload.patientId || '');
        const patientObj2 = patients.find(p => String(p.id) === String(localPatientId2));
        const patientName2 = resp.patient_name ?? (patientObj2 ? `${patientObj2.firstName} ${patientObj2.lastName}` : '');

        addLabOrder({
          id: resp.id ? String(resp.id) : Date.now().toString(),
          patientId: String(resp.patient ?? payload.patientId),
          doctorId: localDoctorId2,
          testIds: createdTestIds.length ? createdTestIds : testIds,
          status: resp.status as any || 'pending',
          orderDate: resp.created_at || new Date().toISOString(),
          // notes removed from lab order model
          // persist testDetails locally in the order record so UI can show them
          testDetails: payload.testDetails || undefined,
          createdAt: resp.created_at || new Date().toISOString(),
          updatedAt: resp.created_at || new Date().toISOString(),
          doctorName: doctorName2,
          patientName: patientName2,
        } as any);
      })
      .catch((err) => {
        console.error('Failed to create lab order', err);
        // fallback: create locally
        const fallbackDoctorId2 = payload.doctorId || (user?.role === 'doctor' ? user.id : '');
        const staffDoctorFallback2 = staff.find(s => String(s.id) === String(fallbackDoctorId2));
        const fallbackDoctorName2 = staffDoctorFallback2 ? `${staffDoctorFallback2.firstName} ${staffDoctorFallback2.lastName}` : (user && user.role === 'doctor' ? formatPersonName(user, 'Dr.') : '');
        const fallbackPatientObj2 = patients.find(p => String(p.id) === String(payload.patientId));
        const fallbackPatientName2 = fallbackPatientObj2 ? `${fallbackPatientObj2.firstName} ${fallbackPatientObj2.lastName}` : '';
        addLabOrder({
          id: Date.now().toString(),
          patientId: payload.patientId,
          doctorId: fallbackDoctorId2,
          testIds,
          status: payload.status || payload.priority || 'pending',
          orderDate: new Date().toISOString(),
          // notes removed
          testDetails: payload.testDetails || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          doctorName: fallbackDoctorName2,
          patientName: fallbackPatientName2,
        } as any);
      })
      .finally(() => {
        // close both modals and reset selection
        setShowInputModal(false);
        setShowModal(false);
        setOrderFormData({
          patientId: '',
          doctorId: user?.role === 'doctor' ? user.id : '',
          selectedTests: { ...defaultSelectedTests },
          priority: '',
          status: 'pending',
          notes: '',
          patientName: ''
        });
      });
  };

  // Helper used when input modal is opened from the Results flow: create one or more lab results
  const createResultsFromInput = (payload: { patientId: string; doctorId?: string; tests: string[]; testDetails?: { key: string; value: string }[] }) => {
    const orderId = resultFormData.orderId;
    if (!orderId) {
      alert('Please select a lab order before entering details for results.');
      return;
    }

    const resolvedOrderIdNum = Number(orderId);
    if (Number.isNaN(resolvedOrderIdNum) || resolvedOrderIdNum <= 0) {
      console.error('Invalid lab order id for creating results', orderId);
      return;
    }

    const details = payload.testDetails && payload.testDetails.length ? payload.testDetails : (payload.tests || []).map(t => ({ key: t, value: '' }));

    // Instead of creating one lab result per test, create a single LabResult whose `result` is an array of strings
    const resultArray: string[] = details.map(d => (d.value && String(d.value).trim()) ? String(d.value).trim() : String(d.key));

    const resultPayload: any = {
      lab_order: resolvedOrderIdNum,
      result: resultArray
    };

    apiCreateLabResult(resultPayload)
      .then((respAny: any) => {
        const resp = respAny as any;
        const createdOrderId = resp.lab_order ? String(resp.lab_order.id ?? resp.lab_order) : String(resp.lab_order ?? '');
        const createdOrder = labOrders.find(o => String(o.id) === createdOrderId);
        const normalized = {
          id: String(resp.id),
          orderId: createdOrderId,
          testId: '',
          testName: (createdOrder && Array.isArray(createdOrder.testIds) && createdOrder.testIds.length) ? labTests.find(t => t.id === createdOrder.testIds[0])?.name || '' : '',
          patientName: createdOrder ? ((createdOrder as any).patientName ?? (createdOrder as any).patient_name ?? '') : '',
          values: normalizeToArray((resp as any).result ?? resultArray),
          pairs: normalizePairs((resp as any).result ?? resultArray, createdOrder ? (createdOrder.testIds ?? null) : null),
          completedAt: (resp as any).created_at ?? new Date().toISOString(),
        } as any;
        addLabResult(normalized as LabResult);
      })
      .catch((err) => {
        console.error('Failed to create lab result for tests', err);
        // fallback: add a single local-only result containing all values
        addLabResult({
          id: Date.now().toString(),
          orderId: String(orderId),
          testId: '',
          testName: '',
          patientName: '',
          values: resultArray,
          completedAt: new Date().toISOString(),
        } as any);
      });

    // close the input modal and the parent result modal
    setShowInputModal(false);
    setShowModal(false);
  };

  useEffect(() => {
    // fetch lab orders from backend and populate the store (mirror new.tsx)
    apiFetchLabOrders()
      .then((data) => {
        setLabOrders(data as any);
      })
      .catch((err) => console.error('Failed to fetch lab orders', err));

    // fetch simplified lab results summary from backend and populate the store
    setResultsLoading(true);
    setResultsError(null);
            apiFetchLabResultsSummary()
      .then((data) => {
        const normalizedResults = (data || []).map((r: any) => ({
          id: String(r.id),
          orderId: r.labOrderId ? String(r.labOrderId) : '',
          testId: '',
          testName: (Array.isArray(r.labOrderTests) && r.labOrderTests[0]) ? String(r.labOrderTests[0]) : (r.labOrderName ?? ''),
          patientName: r.patientName ?? '',
          values: Array.isArray(r.result) ? r.result : (typeof r.result === 'string' ? (function(){ try{ const p=JSON.parse(r.result); return Array.isArray(p)?p:[String(p)]; }catch(e){ return String(r.result).split(',').map((s:string)=>s.trim()).filter(Boolean); } })() : []),
          pairs: normalizePairs(r.result, r.labOrderTests ?? r.labOrderName ?? null),
          unit: '',
          normalRange: '',
          status: 'normal',
          notes: '',
          technician: '',
          reviewedBy: '',
          // Prefer server created_at if provided, otherwise fall back to createdAt or now
          completedAt: (r && (r.created_at ?? r.createdAt)) ? (r.created_at ?? r.createdAt) : new Date().toISOString(),
        }));
        setLabResults(normalizedResults as any);
        setResultsLoading(false);
        setResultsError(null);
      })
      .catch((err) => {
        console.error('Failed to fetch lab results', err);
        setResultsLoading(false);
        setResultsError('Failed to load lab results');
      });
  }, [setLabOrders, setLabResults]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'sample_collected': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'in_progress': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'normal': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'abnormal': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const orderColumns = [
    {
      key: 'patient',
      header: 'Patient',
  render: (_: any, order: LabOrder) => {
        const patient = patients.find(p => p.id === order.patientId);
        const fallbackName = (order as any).patient_name;
        return patient ? (
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">
                {`${patient.firstName} ${patient.lastName}`}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{patient.email}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <User className="w-4 h-4 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{fallbackName || 'Unknown Patient'}</p>
            </div>
          </div>
        );
      }
    },
      {
        key: 'doctor',
        header: 'Doctor',
        render: (_: any, order: LabOrder) => {
          const doctor = staff.find(s => s.id === order.doctorId);
          const fallback = (order as any).doctor_name;
          return doctor ? (
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{formatPersonName(doctor, 'Dr.')}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{doctor.email}</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{fallback || 'Unknown'}</p>
            </div>
          );
        }
      },
    {
      key: 'tests',
      header: 'Tests',
  render: (_: any, order: LabOrder) => {
  const testNames = (order.testIds as string[]).map(id => labTests.find(t => t.id === id)?.name).filter(Boolean) as (string|undefined)[];
  let testsDisplay = '';
  if (testNames.length) {
    testsDisplay = (testNames as string[]).join(', ');
  } else if (order.testIds && Array.isArray(order.testIds) && order.testIds.length) {
    testsDisplay = order.testIds.join(', ');
  } else {
    testsDisplay = (order as any).tests || 'No tests';
  }
        return (
          <div className="max-w-xs">
            <p className="text-sm text-gray-900 dark:text-white truncate">
              {testsDisplay}
            </p>
          </div>
        );
      }
    },
    // notes removed from orders per data model change
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(value)}`}>
          <span className="capitalize">{value.replace('_', ' ')}</span>
        </span>
      )
    },
    {
      key: 'orderDate',
      header: 'Order Date',
      render: (value: string) => formatDate(value)
    },
    {
      key: 'actions',
      header: 'Actions',
  render: (_: any, order: LabOrder) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleOpenModal('order', order)}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleExportOrder(order)}
            leftIcon={<Download className="w-3 h-3" />}
          >
            Export PDF
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() => handleDeleteOrder(order.id)}
            leftIcon={<Trash2 className="w-3 h-3" />}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  // test catalog removed

  // resultColumns removed — grouping is used for Results table now

  // status/priority/category option arrays removed (unused after UI simplification)
  // Re-introduce statusOptions used by the status filter Select so it's defined
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'sample_collected', label: 'Sample Collected' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Laboratory Services</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage lab orders, tests, and results
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => handleExport('csv')}
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export PDF
          </Button>
          <Button
            onClick={() => handleOpenModal(activeTab === 'orders' ? 'order' : 'result')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add {activeTab === 'orders' ? 'Order' : 'Result'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'orders', label: 'Lab Orders', icon: Clock },
            // test catalog removed
            { key: 'results', label: 'Results', icon: CheckCircle }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === key
                  ? 'border-sky-500 text-sky-600 dark:text-sky-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          {activeTab === 'orders' && (
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              options={statusOptions}
              className="w-full lg:w-48"
            />
          )}
        </div>

        {activeTab === 'orders' && (
          <Table
            data={filteredOrders}
            columns={orderColumns}
            emptyMessage="No lab orders found"
          />
        )}

        {/* Test catalog removed */}

        {activeTab === 'results' && (
          <>
            {resultsError && (
              <div className="py-4 text-center text-sm text-red-500">{resultsError}</div>
            )}
                <Table
                  data={groupedResults}
                  loading={resultsLoading}
                  columns={[
                    {
                      key: 'patient',
                      header: 'Patient',
                      render: (_: any, row: any) => (
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{row.patientName}</p>
                        </div>
                      )
                    },
                    {
                      key: 'testsDisplay',
                      header: 'Tests & Results',
                      render: (_: any, row: any) => (
                        <div className="max-w-xs">
                          <p className="text-sm text-gray-900 dark:text-white truncate">{row.testsDisplay}</p>
                        </div>
                      )
                    },
                    {
                      key: 'latestDate',
                      header: 'Latest',
                      render: (value: string) => formatDate(value)
                    },
                    {
                      key: 'actions',
                      header: 'Actions',
                      render: (_: any, row: any) => (
                        <div className="flex space-x-2">
                          <Button size="small" variant="secondary" onClick={() => { setGroupModalItems(row.items || []); setGroupModalOpen(true); }}>
                            Details
                          </Button>
                            <Button size="small" variant="secondary" onClick={() => exportData((row.items || []).map((it: any) => ({ Result: (it.pairs && it.pairs.length) ? it.pairs.map((p:any)=>`${p.testName || ''}: ${p.value}`).join('\n') : (Array.isArray(it.values) ? it.values.join(', ') : (it.value || '')), Date: formatDate(it.completedAt) })), `lab-results-${row.patientName}`, 'pdf', `Lab Results — ${row.patientName}`)}>
                              Export PDF
                            </Button>
                            <Button size="small" variant="danger" onClick={() => {
                              if (!confirm(`Delete all results for ${row.patientName}? This cannot be undone.`)) return;
                              (row.items || []).forEach((it: any) => {
                                handleDeleteResult(String(it.id));
                              });
                              // if the group modal is open, clear its items
                              setGroupModalItems(prev => prev.filter((it: any) => !((row.items || []).find((rIt: any) => rIt.id === it.id))));
                            }}>
                              Delete
                            </Button>
                        </div>
                      )
                    }
                  ]}
                  emptyMessage="No lab results found"
                />
                {/* Modal to view/edit individual results for a patient group */}
                <Modal isOpen={groupModalOpen} onClose={() => setGroupModalOpen(false)} title="Patient Results" size="large">
                  <div className="space-y-3">
                    {(groupModalItems || []).length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">No results</div>
                    ) : (
                      (groupModalItems || []).map((it: any) => (
                        <div key={it.id} className="p-3 border rounded bg-white dark:bg-gray-800 flex items-center justify-between">
                            <div>
                              <div className="text-sm text-gray-500">
                                {(it.pairs || []).length ? (
                                  <ul className="list-disc list-inside">
                                    {(it.pairs || []).map((p: any, i: number) => (
                                      <li key={i}>{(p.testName || (i===0 ? (it.testName || labTests.find((t:any)=>t.id===it.testId)?.name) : ''))}: {p.value}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <>{Array.isArray(it.values) ? it.values.join(', ') : (it.value || '—')}</>
                                )}
                              </div>
                              <div className="text-xs text-gray-400">Date: {formatDate(it.completedAt)}</div>
                            </div>
                          <div className="flex space-x-2">
                            <Button size="small" variant="secondary" onClick={() => { setGroupModalOpen(false); handleOpenModal('result', it); }}>
                              Edit
                            </Button>
                            <Button size="small" variant="danger" onClick={() => { handleDeleteResult(String(it.id)); setGroupModalItems(prev => prev.filter(p => p.id !== it.id)); }}>
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Modal>
          </>
        )}
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={
          modalType === 'order' ? (editingItem ? 'Edit Lab Order' : 'Create Lab Order') :
          (editingItem ? 'Edit Lab Result' : 'Add Lab Result')
        }
        size={modalType === 'order' ? 'extra-large' : 'large'}
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {modalType === 'order' && (
            <>
              {/* Header Information */}
              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg border-2 border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">LABORATORY REQUEST FORM</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Name
                    </label>
                    <div className="flex space-x-2">
                      <Select
                        name="patientId"
                        searchable
                        value={orderFormData.patientId}
                        onChange={(e) => {
                          const patient = patients.find(p => p.id === e.target.value);
                          setOrderFormData({ 
                            ...orderFormData, 
                            patientId: e.target.value,
                            patientName: patient ? `${patient.firstName} ${patient.lastName}` : ''
                          });
                        }}
                        options={patients.map(patient => ({
                          value: patient.id,
                          label: `${patient.firstName} ${patient.lastName}`
                        }))}
                        placeholder="Select patient"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Doctor
                    </label>
                    {isRole(user, 'doctor') ? (
                      // When the logged-in user is a doctor show a read-only label (same UX as Diagnoses/Appointments)
                      <div className="py-2 px-3 rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                        {formatPersonName(user, 'Dr.')}
                      </div>
                    ) : (
                      <Select
                        value={orderFormData.doctorId}
                        onChange={(e) => setOrderFormData({ ...orderFormData, doctorId: e.target.value })}
                        options={doctors.map(doctor => ({
                          value: doctor.id,
                          label: `Dr. ${doctor.firstName} ${doctor.lastName}`
                        }))}
                        placeholder="Select doctor"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                  <Select
                    value={orderFormData.status}
                    onChange={(e) => setOrderFormData({ ...orderFormData, status: e.target.value })}
                    options={[
                      { value: 'pending', label: 'Pending' },
                      { value: 'sample_collected', label: 'Sample Collected' },
                      { value: 'in_progress', label: 'In Progress' },
                      { value: 'completed', label: 'Completed' },
                      { value: 'cancelled', label: 'Cancelled' },
                    ]}
                    className="w-48"
                  />
                </div>
              </div>

              {/* Test Categories */}
              <div className="space-y-6">
                {/* HEMATOLOGY */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-4 bg-gray-100 dark:bg-gray-700 py-2 rounded">
                    HEMATOLOGY
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'hemoglobin', label: 'Hemoglobin(Hb)', unit: 'g/dl' },
                      { key: 'hematocrit', label: 'Hematocrit', unit: '%' },
                      { key: 'platelet', label: 'Platelet', unit: 'mm' },
                      { key: 'neutrophils', label: 'Neutrophils', unit: '%(4-70)' },
                      { key: 'lymphocytes', label: 'Lymphocytes', unit: '%(20-40)' },
                      { key: 'monocytes', label: 'Monocytes', unit: '%(0-7)' },
                      { key: 'eosinophils', label: 'Eosinophils', unit: '%(0-5)' },
                      { key: 'basophils', label: 'Basophils', unit: '%(0-1)' },
                      { key: 'malariaBloodSmear', label: 'Malaria Blood smear', unit: 'MM/2hr' },
                      { key: 'bloodGrouping', label: 'Blood Grouping(ABO Blood)', unit: '2HR' }
                    ].map(test => (
                      <label key={test.key} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={orderFormData.selectedTests[test.key] || false}
                          onChange={(e) => setOrderFormData({
                            ...orderFormData,
                            selectedTests: {
                              ...orderFormData.selectedTests,
                              [test.key]: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{test.label}</span>
                        <span className="text-xs text-gray-500">{test.unit}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* BIOCHEMISTRY */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-4 bg-gray-100 dark:bg-gray-700 py-2 rounded">
                    BIOCHEMISTRY
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'glucose', label: 'Glucose', unit: 'Mg/dl(75-115)' },
                      { key: 'creatinine', label: 'Creatinine', unit: 'mg/dl(UP to 1.3)' },
                      { key: 'bilirubin', label: 'Bilirubin', unit: 'mg/dl(0.0-0.25)' },
                      { key: 'cholesterol', label: 'Cholesterol Tot', unit: 'mg/dl(0-0.25)' },
                      { key: 'sgot', label: 'S.G.O.T.', unit: 'U/(0-12)' },
                      { key: 'sputum', label: 'S-Puture', unit: 'other' }
                    ].map(test => (
                      <label key={test.key} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={orderFormData.selectedTests[test.key] || false}
                          onChange={(e) => setOrderFormData({
                            ...orderFormData,
                            selectedTests: {
                              ...orderFormData.selectedTests,
                              [test.key]: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{test.label}</span>
                        <span className="text-xs text-gray-500">{test.unit}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* SEROLOGY */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-4 bg-gray-100 dark:bg-gray-700 py-2 rounded">
                    SEROLOGY
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'psa', label: 'PSA', unit: '(1-40)' },
                      { key: 'lipidProfile', label: 'Lipid Profile', unit: '(1-40)' },
                      { key: 'parathyroid', label: 'Parathyroid A. Titer', unit: '(1-40)' },
                      { key: 'brucella', label: 'Brucella abortus', unit: '(1-40)' },
                      { key: 'vdrlTest', label: 'VDRL Test', unit: '(NEG)' },
                      { key: 'proteinC', label: 'Protein C Reactive', unit: '(ABC)' },
                      { key: 'toxoplasmosis', label: 'Toxoplasmosis', unit: '(NEG)' },
                      { key: 'typhoid', label: 'Typhoid H', unit: '(1-80)' },
                      { key: 'hepatitisB', label: 'Hepatitis B', unit: '(1-80)' },
                      { key: 'asg', label: 'ASG', unit: '(HCV)' }
                    ].map(test => (
                      <label key={test.key} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={orderFormData.selectedTests[test.key] || false}
                          onChange={(e) => setOrderFormData({
                            ...orderFormData,
                            selectedTests: {
                              ...orderFormData.selectedTests,
                              [test.key]: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{test.label}</span>
                        <span className="text-xs text-gray-500">{test.unit}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* URINALYSIS */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-4 bg-gray-100 dark:bg-gray-700 py-2 rounded">
                    URINALYSIS
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { key: 'leukocytes', label: 'Leukocytes', unit: 'Blood' },
                      { key: 'nitrite', label: 'Nitrite', unit: 'Urine' },
                      { key: 'bilirubin_urine', label: 'Bilirubin', unit: 'PH' },
                      { key: 'ketone', label: 'Ketone', unit: 'Pregnancy' }
                    ].map(test => (
                      <label key={test.key} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={orderFormData.selectedTests[test.key] || false}
                          onChange={(e) => setOrderFormData({
                            ...orderFormData,
                            selectedTests: {
                              ...orderFormData.selectedTests,
                              [test.key]: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{test.label}</span>
                        <span className="text-xs text-gray-500">{test.unit}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* MICROSCOPICAL EXAMINATION */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-4 bg-gray-100 dark:bg-gray-700 py-2 rounded">
                    MICROSCOPICAL EXAMINATION
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { key: 'wbc', label: 'WBC', unit: 'RBC' },
                      { key: 'crystals', label: 'Crystals', unit: 'Casts' },
                      { key: 'parasites', label: 'Parasites', unit: 'Other' }
                    ].map(test => (
                      <label key={test.key} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={orderFormData.selectedTests[test.key] || false}
                          onChange={(e) => setOrderFormData({
                            ...orderFormData,
                            selectedTests: {
                              ...orderFormData.selectedTests,
                              [test.key]: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{test.label}</span>
                        <span className="text-xs text-gray-500">{test.unit}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* STOOL EXAMINATION */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                  <h4 className="text-center text-lg font-bold text-gray-900 dark:text-white mb-4 bg-gray-100 dark:bg-gray-700 py-2 rounded">
                    STOOL EXAMINATION
                  </h4>
                  <div className="text-sm mb-3 text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Macroscopical:</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { key: 'histolytic', label: 'E. Histolytic vegetative', unit: 'A scaris Ova' },
                      { key: 'trichurus', label: 'Trichurus ova', unit: 'Giardia lamblia trophs' },
                      { key: 'ecoli', label: 'E coli trophs ova', unit: 'Strongyloides larvae ova' },
                      { key: 'ent', label: 'ENT vermicularis ova', unit: 'trichomonad homini' },
                      { key: 'chlamydia', label: 'Chlamydia nessali', unit: 'Other' }
                    ].map(test => (
                      <label key={test.key} className="flex items-center space-x-2 text-sm">
                        <input
                          type="checkbox"
                          checked={orderFormData.selectedTests[test.key] || false}
                          onChange={(e) => setOrderFormData({
                            ...orderFormData,
                            selectedTests: {
                              ...orderFormData.selectedTests,
                              [test.key]: e.target.checked
                            }
                          })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300">{test.label}</span>
                        <span className="text-xs text-gray-500">( ) {test.unit} ( )</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Priority, Lab Signature and Additional Notes removed per request */}
              
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center border-t pt-4">
                Printed by Bakaal Tel: 0615667759
              </div>
            </>
          )}

          {/* test modal removed */}

          {modalType === 'result' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lab Order</label>
                  <div className="flex items-center space-x-2">
                    <div className="w-full">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Patient</label>
                      <Select
                        searchable
                        value={resultFormData.patientId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          // set patient id and clear any manual order selection
                          setResultFormData(prev => ({ ...prev, patientId: pid, orderId: '' } as any));
                          // derive latest order for this patient
                          const ordersForPatient = labOrders.filter(o => String(o.patientId) === String(pid) || String((o as any).patient) === String(pid));
                          if (ordersForPatient.length) {
                            const latest = ordersForPatient.sort((a: any, b: any) => new Date(b.orderDate || b.created_at || 0).getTime() - new Date(a.orderDate || a.created_at || 0).getTime())[0];
                            if (latest) setResultFormData(prev => ({ ...prev, orderId: String(latest.id) } as any));
                          }
                        }}
                        options={patients.map(patient => ({ value: patient.id, label: `${patient.firstName} ${patient.lastName}` }))}
                        placeholder="Search patient"
                        required
                      />
                    </div>
                    {/* Button to open the Enter Lab Order Details modal from the Results tab */}
                    {!editingItem && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => {
                        // Determine order to prefill: prefer explicit orderId, otherwise latest for selected patient
                        const selectedOrder = labOrders.find(o => String(o.id) === String(resultFormData.orderId)) || labOrders.filter(o => String(o.patientId) === String(resultFormData.patientId) || String((o as any).patient) === String(resultFormData.patientId)).sort((a:any,b:any)=> new Date(b.orderDate||b.created_at||0).getTime()-new Date(a.orderDate||a.created_at||0).getTime())[0];
                        let testsForModal: string[] = [];
                        let pid = orderFormData.patientId || '';
                        let did = orderFormData.doctorId || '';

                        if (selectedOrder) {
                          if (Array.isArray((selectedOrder as any).testIds)) testsForModal = (selectedOrder as any).testIds;
                          else if (Array.isArray((selectedOrder as any).tests)) testsForModal = (selectedOrder as any).tests;
                          else if (typeof (selectedOrder as any).tests === 'string') testsForModal = String((selectedOrder as any).tests).split(',').map(s => s.trim()).filter(Boolean);

                          pid = String((selectedOrder as any).patientId ?? (selectedOrder as any).patient ?? '');
                          did = String((selectedOrder as any).doctorId ?? (selectedOrder as any).doctor ?? '');
                          // ensure resultFormData.orderId uses this order when opening input modal
                          setResultFormData(prev => ({ ...prev, orderId: String(selectedOrder.id), patientId: pid } as any));
                        }

                        setInputModalTests(testsForModal);
                        // prefill the main order form patient/doctor so the modal shows correct selection
                        setOrderFormData(prev => ({ ...prev, patientId: pid, doctorId: did }));
                        // indicate the input modal should create results when submitted
                        setInputModalMode('result');
                        setShowInputModal(true);
                      }}
                    >
                      Order Details
                      </Button>
                    )}
                  </div>
                </div>

                {/* Result values are entered via the 'Order Details' modal. The free-form comma-separated input was removed. */}
                {/* Single-pair edit controls: allow selecting which test/result to edit and change its value */}
                {editingItem && editingValues && (
                  <div className="mt-4 space-y-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Enter results for each test below</h3>
                    <div className="divide-y">
                      {editingValues.map((_val, idx) => {
                        // derive test label/unit/range from editingItem.pairs or labTests lookup
                        const testLabel = (editingItem.pairs && editingItem.pairs[idx] && editingItem.pairs[idx].testName) || editingItem.testName || (labTests.find((t:any) => t.id === editingItem.testId)?.name) || `Test ${idx+1}`;
                        const unit = labTests.find((t:any) => t.id === editingItem.testId)?.unit || '';
                        const normalRange = labTests.find((t:any) => t.id === editingItem.testId)?.normalRange || '';
                        return (
                          <div key={idx} className="py-2 grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-5">
                              <div className="text-sm font-medium text-gray-800 dark:text-white">{testLabel}</div>
                              {normalRange && <div className="text-xs text-gray-500">Reference: {normalRange}</div>}
                            </div>
                            <div className="col-span-4">
                              <Input
                                value={editingValues[idx] ?? ''}
                                onChange={(e) => {
                                  const next = editingValues.slice();
                                  next[idx] = e.target.value;
                                  setEditingValues(next);
                                  // keep editingPairIndex/value synced for compatibility
                                  setEditingPairIndex(idx);
                                  setEditingPairValue(next[idx] ?? '');
                                }}
                                placeholder="Enter result"
                              />
                            </div>
                            <div className="col-span-3 text-sm text-gray-600">
                              {unit && <div>Unit: {unit}</div>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingItem ? 'Update' : 'Create'} {modalType === 'order' ? 'Lab Order' : 'Result'}
            </Button>
          </div>
        </form>
      </Modal>
      {/* Secondary input modal shown after selecting tests when creating an order */}
      <LabOrderInputModal
        isOpen={showInputModal}
        onClose={() => setShowInputModal(false)}
        patientId={orderFormData.patientId}
        doctorId={orderFormData.doctorId}
        selectedCategoryKeys={inputModalTests}
        mode={inputModalMode}
        title={inputModalMode === 'order' ? 'Enter Lab Order Details' : 'Enter Lab Result Details'}
        submitLabel={inputModalMode === 'order' ? 'Create Order' : 'Create Result(s)'}
        onSubmit={(payload) => inputModalMode === 'order' ? createOrderFromInput(payload) : createResultsFromInput(payload as any)}
      />
    </div>
  );
};