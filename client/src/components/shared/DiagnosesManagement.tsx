import React, { useState, useMemo } from 'react';
import { Plus, Search, Edit, Download, User, Calendar, Stethoscope, Trash2 } from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import { useAuthStore } from '../../store/authStore';
import type { Diagnosis as ApiDiagnosis, PrescribedMedicine } from '../../Api/diagnosisApi';
import { fetchDiagnoses, createDiagnosis, updateDiagnosis as apiUpdateDiagnosis, deleteDiagnosis } from '../../Api/diagnosisApi';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils'; // will be used correctly below

export const Diagnoses: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    patients, 
    staff,
    setDiagnoses: setStoreDiagnoses
  } = useHospitalStore();
  const [diagnoses, setDiagnoses] = useState<ApiDiagnosis[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDoctor, setFilterDoctor] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingDiagnosis, setEditingDiagnosis] = useState<ApiDiagnosis | null>(null);
  const [formData, setFormData] = useState<{
    patient: string;
    doctor: string;
    symptoms: string;
    diagnosis: string;
    treatment_plan: string;
    medications: string[]; // UI uses simple strings; map to PrescribedMedicine on submit
    notes: string;
  }>({
    patient: '',
    doctor: '',
    symptoms: '',
    diagnosis: '',
    treatment_plan: '',
    medications: [],
    notes: ''
  });

  // Fetch diagnoses from API
  React.useEffect(() => {
    let mounted = true;
    fetchDiagnoses()
      .then(data => {
        if (!mounted) return;
        // local component state (API shape)
        setDiagnoses(data);

        // map API diagnosis shape to client Diagnosis shape used in hospital store
        const mapped = data.map(d => ({
          id: String(d.id),
          patientId: String(d.patient),
          doctorId: d.doctor != null ? String(d.doctor) : '',
          appointmentId: '',
          symptoms: d.symptoms,
          diagnosis: d.diagnosis,
          treatmentPlan: d.treatment_plan || '',
          medications: (d.prescribed_medicines || []).map(m => m.name || ''),
          followUpRequired: false,
          notes: d.additional_notes || '',
          createdAt: d.created_at,
          updatedAt: d.created_at
        }));

        setStoreDiagnoses(mapped as any);
      })
      .catch(err => console.error('Failed to fetch diagnoses', err));
    return () => { mounted = false; };
  }, []);

  const filteredDiagnoses = useMemo(() => {
    return diagnoses.filter(diagnosis => {
      const patient = patients.find(p => String(p.id) === String(diagnosis.patient));
      const q = searchTerm.toLowerCase();
      const matchesSearch = !!patient && (
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(q) ||
        diagnosis.diagnosis.toLowerCase().includes(q) ||
        diagnosis.symptoms.toLowerCase().includes(q)
      );

      const matchesDoctor = !filterDoctor || String(diagnosis.doctor || '') === String(filterDoctor);
      const matchesDoctorRole = user?.role !== 'doctor' || String(diagnosis.doctor || '') === String(user?.id);

      return matchesSearch && matchesDoctor && matchesDoctorRole;
    });
  }, [diagnoses, patients, staff, searchTerm, filterDoctor, user]);

  const doctors = staff.filter(s => s.role === 'doctor');

  const handleOpenModal = (diagnosis?: ApiDiagnosis) => {
    if (diagnosis) {
      setEditingDiagnosis(diagnosis);
      setFormData({
        patient: String(diagnosis.patient),
        doctor: diagnosis.doctor != null ? String(diagnosis.doctor) : '',
        symptoms: diagnosis.symptoms,
        diagnosis: diagnosis.diagnosis,
        treatment_plan: diagnosis.treatment_plan || '',
        medications: (diagnosis.prescribed_medicines || []).map(m => m.name || ''),
        notes: diagnosis.additional_notes || ''
      });
    } else {
      setEditingDiagnosis(null);
      setFormData({
        patient: '',
        doctor: user?.role === 'doctor' ? String(user.id) : '',
        symptoms: '',
        diagnosis: '',
        treatment_plan: '',
        medications: [],
        notes: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingDiagnosis(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      // API expects numeric IDs
      patient: Number(formData.patient),
      doctor: formData.doctor ? Number(formData.doctor) : null,
      symptoms: formData.symptoms,
      treatment_plan: formData.treatment_plan,
      diagnosis: formData.diagnosis,
      prescribed_medicines: formData.medications.map<PrescribedMedicine>(m => ({ name: m })),
      additional_notes: formData.notes || null
    };

    try {
      if (editingDiagnosis) {
        const updated = await apiUpdateDiagnosis(editingDiagnosis.id, payload);
        // update local state (API shape)
        const newLocal = diagnoses.map(d => (d.id === updated.id ? updated : d));
        setDiagnoses(newLocal);

        // update store with mapped shapes
        const newStore = newLocal.map(d => ({
          id: String(d.id),
          patientId: String(d.patient),
          doctorId: d.doctor != null ? String(d.doctor) : '',
          appointmentId: '',
          symptoms: d.symptoms,
          diagnosis: d.diagnosis,
          treatmentPlan: d.treatment_plan || '',
          medications: (d.prescribed_medicines || []).map(m => m.name || ''),
          followUpRequired: false,
          notes: d.additional_notes || '',
          createdAt: d.created_at,
          updatedAt: d.created_at
        }));
        setStoreDiagnoses(newStore as any);
      } else {
        const created = await createDiagnosis(payload);
        const newLocal = [created, ...diagnoses];
        setDiagnoses(newLocal);
        // add to store
        const newStore = newLocal.map(d => ({
          id: String(d.id),
          patientId: String(d.patient),
          doctorId: d.doctor != null ? String(d.doctor) : '',
          appointmentId: '',
          symptoms: d.symptoms,
          diagnosis: d.diagnosis,
          treatmentPlan: d.treatment_plan || '',
          medications: (d.prescribed_medicines || []).map(m => m.name || ''),
          followUpRequired: false,
          notes: d.additional_notes || '',
          createdAt: d.created_at,
          updatedAt: d.created_at
        }));
        setStoreDiagnoses(newStore as any);
      }
    } catch (err) {
      console.error('Failed to save diagnosis', err);
      alert('Failed to save diagnosis');
    } finally {
      handleCloseModal();
    }
  };

  const handleMedicationChange = (index: number, value: string) => {
    const newMedications = [...formData.medications];
    newMedications[index] = value;
    setFormData({ ...formData, medications: newMedications });
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this diagnosis?')) return;
    try {
      await deleteDiagnosis(id);
      // remove from local list
      const newLocal = diagnoses.filter(d => d.id !== id);
      setDiagnoses(newLocal);
      // remove from store
      const newStore = newLocal.map(d => ({
        id: String(d.id),
        patientId: String(d.patient),
        doctorId: d.doctor != null ? String(d.doctor) : '',
        appointmentId: '',
        symptoms: d.symptoms,
        diagnosis: d.diagnosis,
        treatmentPlan: d.treatment_plan || '',
        medications: (d.prescribed_medicines || []).map(m => m.name || ''),
        followUpRequired: false,
        notes: d.additional_notes || '',
        createdAt: d.created_at,
        updatedAt: d.created_at
      }));
      setStoreDiagnoses(newStore as any);
    } catch (err) {
      console.error('Failed to delete diagnosis', err);
      alert('Failed to delete diagnosis');
    }
  };

  const addMedication = () => {
    setFormData({ ...formData, medications: [...formData.medications, ''] });
  };

  const removeMedication = (index: number) => {
    const newMedications = formData.medications.filter((_, i) => i !== index);
    setFormData({ ...formData, medications: newMedications });
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const dataToExport = filteredDiagnoses.map(diagnosis => {
      const patient = patients.find(p => String(p.id) === String(diagnosis.patient));
      const doctor = staff.find(s => String(s.id) === String(diagnosis.doctor));

      return {
        'Date': formatDate(diagnosis.created_at),
        'Patient': patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
        'Doctor': doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Unknown',
        'Symptoms': diagnosis.symptoms,
        'Diagnosis': diagnosis.diagnosis,
        'Treatment Plan': diagnosis.treatment_plan || '',
        'Medications': (diagnosis.prescribed_medicines || []).map(m => m.name).join(', ') || 'None',
        'Notes': diagnosis.additional_notes || ''
      };
    });

    exportData(dataToExport, 'diagnoses-report', format, 'Diagnoses Report');
  };

  const columns = [
    {
      key: 'patient',
      header: 'Patient',
      render: (_: any, diagnosis: ApiDiagnosis) => {
  const patient = patients.find(p => String(p.id) === String(diagnosis.patient));
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
        ) : 'Unknown Patient';
      }
    },
    {
      key: 'doctor',
      header: 'Doctor',
      render: (_: any, diagnosis: ApiDiagnosis) => {
  const doctor = staff.find(s => String(s.id) === String(diagnosis.doctor));
        return doctor ? (
          <div className="flex items-center space-x-2">
            <Stethoscope className="w-4 h-4 text-gray-400" />
            <span>{`Dr. ${doctor.firstName} ${doctor.lastName}`}</span>
          </div>
        ) : 'Unknown Doctor';
      }
    },
    {
      key: 'diagnosis',
      header: 'Diagnosis',
      render: (value: string) => (
        <div className="max-w-xs">
          <p className="font-medium text-gray-900 dark:text-white truncate">{value}</p>
        </div>
      )
    },
    {
      key: 'symptoms',
      header: 'Symptoms',
      render: (value: string) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{value}</p>
        </div>
      )
    },
    {
      key: 'prescribed_medicines',
      header: 'Prescribed Medicine',
      render: (_: any, diagnosis: ApiDiagnosis) => (
        <div className="max-w-xs">
          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{(diagnosis.prescribed_medicines || []).map(m => m.name).join(', ') || '—'}</p>
        </div>
      )
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (_: any, diagnosis: ApiDiagnosis) => (
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{diagnosis.additional_notes || '—'}</p>
          </div>
        </div>
      )
    },
    {
      key: 'date',
      header: 'Date',
      render: (_: any, diagnosis: ApiDiagnosis) => formatDate(diagnosis.created_at)
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, diagnosis: ApiDiagnosis) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleOpenModal(diagnosis as any)}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() => handleDelete(diagnosis.id)}
            leftIcon={<Trash2 className="w-3 h-3" />}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Diagnoses</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage patient diagnoses and treatment plans
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
            onClick={() => handleOpenModal()}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Diagnosis
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search diagnoses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          {user?.role === 'admin' && (
            <Select
              value={filterDoctor}
              onChange={(e) => setFilterDoctor(e.target.value)}
              options={[
                { value: '', label: 'All Doctors' },
                ...doctors.map(doctor => ({
                  value: doctor.id,
                  label: `Dr. ${doctor.firstName} ${doctor.lastName}`
                }))
              ]}
              className="w-full lg:w-48"
            />
          )}
        </div>

        <Table
          data={filteredDiagnoses}
          columns={columns}
          emptyMessage="No diagnoses found"
        />
      </Card>

      {/* Add/Edit Diagnosis Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingDiagnosis ? 'Edit Diagnosis' : 'Add New Diagnosis'}
        size="extra-large"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Patient"
              name="patient"
              value={formData.patient}
              onChange={(e) => setFormData({ ...formData, patient: e.target.value })}
              options={patients.map(patient => ({
                value: patient.id,
                label: `${patient.firstName} ${patient.lastName}`
              }))}
              placeholder="Search or select patient"
              required
              searchable
            />
            <Select
              label="Doctor"
              name="doctor"
              value={formData.doctor}
              onChange={(e) => setFormData({ ...formData, doctor: e.target.value })}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Symptoms
            </label>
            <textarea
              name="symptoms"
              rows={3}
              value={formData.symptoms}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2"
              placeholder="Describe the patient's symptoms..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Diagnosis
            </label>
            <textarea
              name="diagnosis"
              rows={3}
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2"
              placeholder="Enter the diagnosis..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Treatment Plan
            </label>
            <textarea
              name="treatment_plan"
              rows={4}
              value={formData.treatment_plan}
              onChange={(e) => setFormData({ ...formData, treatment_plan: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2"
              placeholder="Describe the treatment plan..."
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prescribed Medicines
              </label>
              <Button
                type="button"
                size="small"
                variant="secondary"
                onClick={addMedication}
                leftIcon={<Plus className="w-3 h-3" />}
              >
                Add Medicine
              </Button>
            </div>
            <div className="space-y-2">
              {formData.medications.map((medication, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <Input
                    value={medication}
                    onChange={(e) => handleMedicationChange(index, e.target.value)}
                    placeholder="Medication name (e.g. Paracetamol 500mg)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    size="small"
                    variant="danger"
                    onClick={() => removeMedication(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* follow-up fields removed; API doesn't provide followUp fields */}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Additional Notes
            </label>
            <textarea
              name="notes"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2"
              placeholder="Any additional notes or observations..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingDiagnosis ? 'Update Diagnosis' : 'Add Diagnosis'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};