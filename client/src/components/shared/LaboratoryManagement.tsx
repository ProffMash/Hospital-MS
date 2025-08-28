import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit, Download, Clock, CheckCircle, User, Trash2 } from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import { useAuthStore } from '../../store/authStore';
import type { LabOrder, LabResult } from '../../types/index';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils';
import { createLabOrder as apiCreateLabOrder, updateLabOrder as apiUpdateLabOrder, fetchLabOrders as apiFetchLabOrders, deleteLabOrder as apiDeleteLabOrder } from '../../Api/labOrdersApi';
import {
  fetchLabResultsSummary as apiFetchLabResultsSummary,
  createLabResult as apiCreateLabResult,
  updateLabResult as apiUpdateLabResult,
  deleteLabResult as apiDeleteLabResult,
} from '../../Api/labResultsApi';

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
  setLabOrders,
  addLabResult,
  updateLabResult,
  deleteLabResult,
  deleteLabOrder,
  setLabResults
  } = useHospitalStore();

  const [resultsLoading, setResultsLoading] = useState(false);
  const [resultsError, setResultsError] = useState<string | null>(null);

  useEffect(() => {
    // fetch lab orders from backend and populate the store
    apiFetchLabOrders()
      .then((data) => {
        // store backend-shaped objects directly; normalization is handled in the component
        setLabOrders(data as any);
      })
      .catch((err) => console.error('Failed to fetch lab orders', err));
    // fetch simplified lab results summary from backend and populate the store
    setResultsLoading(true);
    setResultsError(null);
    apiFetchLabResultsSummary()
      .then((data) => {
        // Map simplified server shape { id, result, labOrderName, patientName }
        // into the store's LabResult-like normalized shape used by the component.
        const normalizedResults = (data || []).map((r: any) => ({
          id: String(r.id),
          orderId: r.labOrderId ? String(r.labOrderId) : '',
          testId: '',
          // prefer explicit labOrderTests array if present, otherwise fall back to labOrderName
          testName: (Array.isArray(r.labOrderTests) && r.labOrderTests[0]) ? String(r.labOrderTests[0]) : (r.labOrderName ?? ''),
          patientName: r.patientName ?? '',
          value: r.result ?? '',
          unit: '',
          normalRange: '',
          status: 'normal',
          notes: '',
          technician: '',
          reviewedBy: '',
          completedAt: new Date().toISOString(),
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
  }, [setLabOrders]);
  
  const [activeTab, setActiveTab] = useState<'orders' | 'results'>('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'order' | 'test' | 'result'>('order');
  const [editingItem, setEditingItem] = useState<any>(null);
  
  const [orderFormData, setOrderFormData] = useState({
    patientId: '',
    doctorId: '',
  tests: '',
  status: '',
  notes: ''
  });

  // test catalog removed; labTests array still available for selection

  const [resultFormData, setResultFormData] = useState({
    orderId: '',
    testId: '',
  completedAt: new Date().toISOString(),
  result: ''
  });

  const filteredOrders = useMemo(() => {
    // normalize lab orders to handle server-shaped objects
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
      const matchesDoctor = user?.role !== 'doctor' || order.doctorId === user.id || (order.doctor && String(order.doctor) === user?.id);

      return matchesSearch && matchesStatus && matchesDoctor;
    });
  }, [labOrders, patients, staff, searchTerm, filterStatus, user]);

  // ...tests removed; labTests still available for selecting in results modal

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

  const handleOpenModal = (type: 'order' | 'test' | 'result', item?: any) => {
    setModalType(type);
    setEditingItem(item);
    // prefill forms when opening modals
    if (type === 'order') {
      if (item) {
        // Prefer item.tests, but if not present, join testIds as a string
        let testsValue = '';
        if (item.tests) {
          testsValue = item.tests;
        } else if (item.testIds && Array.isArray(item.testIds)) {
          testsValue = item.testIds.join(', ');
        }
        setOrderFormData({
          patientId: item.patientId ?? (item.patient ? String(item.patient) : ''),
          doctorId: item.doctorId ?? (item.doctor ? String(item.doctor) : ''),
          tests: testsValue,
          status: item.status ?? '',
          notes: item.notes || ''
        });
      } else {
        setOrderFormData({
          patientId: '',
          doctorId: user?.role === 'doctor' ? user.id : '',
          tests: '',
          status: 'pending',
          notes: ''
        });
      }
    } else if (type === 'result') {
      if (item) {
        setResultFormData({
          orderId: item.orderId,
          testId: item.testId ?? '',
          completedAt: item.completedAt || new Date().toISOString(),
          result: (item as any).value ?? (item as any).result ?? ''
        });
      } else {
        setResultFormData({
          orderId: '',
          testId: '',
          completedAt: new Date().toISOString(),
          result: ''
        });
      }
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingItem(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType === 'order') {
      const payload: any = {
        patient: Number(orderFormData.patientId),
        doctor: orderFormData.doctorId ? Number(orderFormData.doctorId) : null,
        tests: orderFormData.tests || '',
        notes: orderFormData.notes || null,
        status: orderFormData.status || (editingItem ? editingItem.status : 'pending')
      };

      if (editingItem) {
        const resolvedIdKey = editingItem?.id ?? (editingItem as any)?.orderId ?? (editingItem as any)?.pk ?? '';
        if (!resolvedIdKey) {
          console.error('Cannot update lab order: invalid id', resolvedIdKey, editingItem);
        } else {
          apiUpdateLabOrder(resolvedIdKey, payload as any)
            .then((resp) => {
              const localId = String(resolvedIdKey);
              updateLabOrder(localId, {
                patientId: String(resp.patient),
                doctorId: resp.doctor ? String(resp.doctor) : '',
                testIds: resp.tests ? (Array.isArray(resp.tests) ? resp.tests : String(resp.tests).split(',').map((t: string) => t.trim())) : [],
                status: resp.status as any,
                notes: resp.notes || '',
                orderDate: resp.created_at || new Date().toISOString(),
              });
            })
            .catch((err) => console.error('Failed to update lab order', err));
        }
      } else {
        apiCreateLabOrder(payload as any)
          .then((resp) => {
            let testIds: string[] = [];
            if (Array.isArray(resp.tests)) {
              testIds = resp.tests;
            } else if (typeof resp.tests === 'string') {
              testIds = resp.tests.split(',').map((t: string) => t.trim()).filter(Boolean);
            }
            addLabOrder({
              id: resp.id ? String(resp.id) : '',
              patientId: String(resp.patient),
              doctorId: resp.doctor ? String(resp.doctor) : '',
              testIds,
              status: resp.status as any,
              orderDate: resp.created_at || new Date().toISOString(),
              notes: resp.notes || '',
              createdAt: resp.created_at || new Date().toISOString(),
              updatedAt: resp.created_at || new Date().toISOString(),
            });
          })
          .catch((err) => console.error('Failed to create lab order', err));
      }
    } else if (modalType === 'result') {
      const resultData = {
        id: editingItem?.id || Date.now().toString(),
        orderId: resultFormData.orderId,
        testId: '',
        value: resultFormData.result || editingItem?.value || '',
        unit: '',
        normalRange: '',
        status: (editingItem?.status as any) || 'normal',
        notes: editingItem?.notes || '',
        technician: editingItem?.technician || user?.name || '',
        completedAt: resultFormData.completedAt || new Date().toISOString()
      } as any;

      if (editingItem) {
        const payload: any = {
          lab_order: Number(resultFormData.orderId),
          result: resultFormData.result || (editingItem?.value || '')
        };
        apiUpdateLabResult(Number(editingItem.id), payload)
          .then((respAny: any) => {
            const resp = respAny as any;
            const resolvedOrderId = resp.lab_order ? String(resp.lab_order.id ?? resp.lab_order) : String(resp.lab_order ?? '');
            const matchingOrder = labOrders.find(o => String(o.id) === resolvedOrderId);
            let resolvedTestName = '';
            if (matchingOrder) {
              if (matchingOrder.testIds && Array.isArray(matchingOrder.testIds) && matchingOrder.testIds.length) {
                const tid = matchingOrder.testIds[0];
                resolvedTestName = labTests.find(t => t.id === tid)?.name || tid || '';
              } else if ((matchingOrder as any).tests) {
                if (Array.isArray((matchingOrder as any).tests)) resolvedTestName = (matchingOrder as any).tests[0] ?? '';
                else resolvedTestName = String((matchingOrder as any).tests).split(',')[0].trim();
              }
            }
            const normalized = {
              id: String(resp.id),
              orderId: resolvedOrderId,
              testId: (resp as any).test_id ? String((resp as any).test_id) : '',
              testName: resolvedTestName,
              patientName: matchingOrder ? ((matchingOrder as any).patientName ?? (matchingOrder as any).patient_name ?? '') : '',
              value: (resp as any).result ?? resultFormData.result ?? (editingItem?.value ?? ''),
              unit: (resp as any).unit ?? resultData.unit,
              normalRange: (resp as any).reference_range ?? resultData.normalRange,
              status: (resp as any).status ?? resultData.status,
              notes: (resp as any).notes ?? resultData.notes,
              technician: (resp as any).technician ?? resultData.technician,
              completedAt: (resp as any).created_at ?? resultData.completedAt ?? resultFormData.completedAt,
            } as any;
            updateLabResult(String(editingItem.id), normalized);
          })
          .catch((err) => {
            console.error('Failed to update lab result', err);
            updateLabResult(editingItem.id, resultData as any);
          });
      } else {
        const resolvedOrderId = Number(resultFormData.orderId);
        if (!resultFormData.orderId || Number.isNaN(resolvedOrderId) || resolvedOrderId <= 0) {
          console.error('Cannot create lab result: invalid lab order id', resultFormData.orderId);
          addLabResult(resultData as LabResult);
        } else {
          const payload: any = {
            lab_order: resolvedOrderId,
            result: resultFormData.result || (editingItem?.value || '')
          };
          apiCreateLabResult(payload)
            .then((respAny: any) => {
              const resp = respAny as any;
              const createdOrderId = resp.lab_order ? String(resp.lab_order.id ?? resp.lab_order) : String(resp.lab_order ?? '');
              const createdOrder = labOrders.find(o => String(o.id) === createdOrderId);
              let createdTestName = '';
              if (createdOrder) {
                if (createdOrder.testIds && Array.isArray(createdOrder.testIds) && createdOrder.testIds.length) {
                  const tid = createdOrder.testIds[0];
                  createdTestName = labTests.find(t => t.id === tid)?.name || tid || '';
                } else if ((createdOrder as any).tests) {
                  if (Array.isArray((createdOrder as any).tests)) createdTestName = (createdOrder as any).tests[0] ?? '';
                  else createdTestName = String((createdOrder as any).tests).split(',')[0].trim();
                }
              }
              const normalized = {
                id: String(resp.id),
                orderId: createdOrderId,
                testId: (resp as any).test_id ? String((resp as any).test_id) : '',
                testName: createdTestName,
                patientName: createdOrder ? ((createdOrder as any).patientName ?? (createdOrder as any).patient_name ?? '') : '',
                value: (resp as any).result ?? resultFormData.result ?? (editingItem?.value ?? ''),
                unit: (resp as any).unit ?? resultData.unit,
                normalRange: (resp as any).reference_range ?? resultData.normalRange,
                status: (resp as any).status ?? resultData.status,
                notes: (resp as any).notes ?? resultData.notes,
                technician: (resp as any).technician ?? resultData.technician,
                completedAt: (resp as any).created_at ?? resultData.completedAt ?? resultFormData.completedAt,
              } as any;
              addLabResult(normalized as LabResult);
            })
            .catch((err) => {
              console.error('Failed to create lab result', err);
              addLabResult(resultData as LabResult);
            });
        }
      }
    }
    handleCloseModal();
  };

  // date helpers removed (modal no longer collects date/time)

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
              value: r.result ?? '',
              unit: '',
              normalRange: '',
              status: 'normal',
              notes: '',
              technician: '',
              reviewedBy: '',
              completedAt: new Date().toISOString(),
            }));
            setLabResults(normalizedResults as any);
          })
          .catch(() => {
            // swallow secondary error
          });
      });
  };

  const handleDeleteOrder = (id: string) => {
    // confirm then optimistic remove
    if (!confirm('Delete this lab order? This action cannot be undone.')) return;
    // remove locally first
    deleteLabOrder(id);

    const idNum = Number(id);
    if (!id || Number.isNaN(idNum) || idNum <= 0) {
      // local-only order, nothing to delete on server
      return;
    }

    // attempt server deletion; on failure, refetch orders from server to recover
    apiDeleteLabOrder(idNum).catch((err) => {
      console.error('Failed to delete lab order on server', err);
      apiFetchLabOrders()
        .then((data) => setLabOrders(data as any))
        .catch(() => {
          // swallow secondary error
        });
    });
  };

  const handleExport = (format: 'csv' | 'pdf') => {
  let dataToExport: any[] = [];
    let filename = '';
    let title = '';
    
    if (activeTab === 'orders') {
      dataToExport = filteredOrders.map(order => {
        const patient = patients.find(p => p.id === order.patientId);
        const doctor = staff.find(s => s.id === order.doctorId);
        const tests = (order.testIds as string[]).map(id => labTests.find(t => t.id === id)?.name).filter(Boolean).join(', ');
        return {
          'Patient': patient ? `${patient.firstName} ${patient.lastName}` : ((order as any).patient_name || 'Unknown'),
          'Doctor': doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : ((order as any).doctor_name || 'Unknown'),
          'Tests': tests,
          'Notes': order.notes || (order as any).notes || '—',
          'Status': order.status,
          'Order Date': formatDate(order.orderDate)
        };
      });
      filename = 'lab-orders-report';
      title = 'Lab Orders Report';
    } else if (activeTab === 'results') {
      dataToExport = filteredResults.map(result => {
        const order = labOrders.find(o => o.id === result.orderId);
        const test = labTests.find(t => t.id === result.testId);
        const patient = order ? patients.find(p => p.id === order.patientId) : null;
        return {
          'Test': (result as any).testName || test?.name || 'Unknown Test',
          'Patient': (result as any).patientName || (patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown'),
          'Result': result.value,
          'Status': result.status,
          'Date': formatDate(result.completedAt)
        };
      });
      filename = 'lab-results-report';
      title = 'Lab Results Report';
    }
    exportData(dataToExport, filename, format, title);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'sample_collected': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
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
              <p className="font-medium text-gray-900 dark:text-white">{`Dr. ${doctor.firstName} ${doctor.lastName}`}</p>
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
    {
      key: 'notes',
      header: 'Notes',
      render: (_: any, order: LabOrder) => (
        <div className="max-w-sm">
          <p className="text-sm text-gray-900 dark:text-white truncate">{order.notes || (order as any).notes || '—'}</p>
        </div>
      )
    },
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

  const resultColumns = [
    {
      key: 'test',
      header: 'Test',
      render: (_: any, result: LabResult) => {
  const test = labTests.find(t => t.id === result.testId);
  // prefer resolved test name from server if provided, otherwise look up by id
  // @ts-ignore - normalized objects may include testName
  return (result as any).testName || test?.name || 'Unknown Test';
      }
    },
    {
      key: 'patient',
      header: 'Patient',
      render: (_: any, result: LabResult) => {
  // prefer server-provided patientName, otherwise resolve from order -> patient
  // @ts-ignore
  if ((result as any).patientName) return (result as any).patientName;
  const order = labOrders.find(o => o.id === result.orderId);
  const patient = order ? patients.find(p => p.id === order.patientId) : null;
  return patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown';
      }
    },
    {
      key: 'value',
      header: 'Result',
      render: (value: string) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{value}</p>
        </div>
      )
    },
    {
      key: 'completedAt',
      header: 'Date',
      render: (value: string) => formatDate(value)
    }
    ,
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, result: LabResult) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleOpenModal('result', result)}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() => handleDeleteResult(result.id)}
            leftIcon={<Trash2 className="w-3 h-3" />}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'pending', label: 'Pending' },
    { value: 'sample_collected', label: 'Sample Collected' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Laboratory Services</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
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
            {resultsLoading && (
              <div className="py-4 text-center text-sm text-gray-500">Loading lab results...</div>
            )}
            {resultsError && (
              <div className="py-4 text-center text-sm text-red-500">{resultsError}</div>
            )}
            <Table
              data={filteredResults}
              columns={resultColumns}
              emptyMessage="No lab results found"
            />
          </>
        )}
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={
          modalType === 'order' ? (editingItem ? 'Edit Lab Order' : 'Create Lab Order') :
          /* test modal removed */
          (editingItem ? 'Edit Lab Result' : 'Add Lab Result')
        }
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {modalType === 'order' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Patient"
                  value={orderFormData.patientId}
                  onChange={(e) => setOrderFormData({ ...orderFormData, patientId: e.target.value })}
                  options={patients.map(patient => ({
                    value: patient.id,
                    label: `${patient.firstName} ${patient.lastName}`
                  }))}
                  placeholder="Search or select patient"
                  searchable
                  required
                />
                <Select
                  label="Doctor"
                  value={orderFormData.doctorId}
                  onChange={(e) => setOrderFormData({ ...orderFormData, doctorId: e.target.value })}
                  options={doctors.map(doctor => ({
                    value: doctor.id,
                    label: `Dr. ${doctor.firstName} ${doctor.lastName}`
                  }))}
                  placeholder="Select doctor"
                  required
                  disabled={user?.role === 'doctor'}
                />
                
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tests (comma-separated)
                </label>
                <Input
                  value={orderFormData.tests}
                  onChange={(e) => setOrderFormData({ ...orderFormData, tests: e.target.value })}
                  placeholder="e.g. cholesterol, glucose"
                />
              </div>

              <div>
                <Select
                  label="Status"
                  value={orderFormData.status}
                  onChange={(e) => setOrderFormData({ ...orderFormData, status: e.target.value })}
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'sample_collected', label: 'Sample Collected' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'cancelled', label: 'Cancelled' }
                  ]}
                  placeholder="Select status"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes
                </label>
                <textarea
                  rows={3}
                  value={orderFormData.notes}
                  onChange={(e) => setOrderFormData({ ...orderFormData, notes: e.target.value })}
                  className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2"
                  placeholder="Additional notes or instructions..."
                />
              </div>
            </>
          )}

          {/* test modal removed */}

          {modalType === 'result' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Lab Order"
                  value={resultFormData.orderId}
                  onChange={(e) => setResultFormData({ ...resultFormData, orderId: e.target.value })}
                  options={labOrders.map(order => {
                    const patient = patients.find(p => p.id === order.patientId);
                    // build readable label from tests or testIds
                    let testsLabel = '';
                    if ((order as any).testIds && Array.isArray((order as any).testIds) && (order as any).testIds.length) {
                      testsLabel = (order as any).testIds.map((id: string) => labTests.find(t => t.id === id)?.name).filter(Boolean).join(', ');
                    } else if ((order as any).tests) {
                      const ot = (order as any).tests;
                      if (Array.isArray(ot)) testsLabel = ot.join(', ');
                      else testsLabel = String(ot).split(',').map((s: string) => s.trim()).filter(Boolean).join(', ');
                    }
                    const patientLabel = patient ? `${patient.firstName} ${patient.lastName}` : ((order as any).patient_name || 'Unknown');
                    const label = testsLabel ? `${testsLabel} — ${patientLabel}` : `${patientLabel} — ${formatDate(order.orderDate)}`;
                    return { value: order.id, label };
                  })}
                  placeholder="Search or select lab order"
                  searchable
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Result</label>
                  <Input
                    value={resultFormData.result}
                    onChange={(e) => setResultFormData({ ...resultFormData, result: e.target.value })}
                    placeholder="Enter result value or text"
                    required
                  />
                </div>
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
              {editingItem ? 'Update' : 'Add'} {modalType === 'order' ? 'Order' : modalType === 'test' ? 'Test' : 'Result'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};