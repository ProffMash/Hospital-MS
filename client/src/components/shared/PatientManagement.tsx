import React, { useState } from 'react';
import { Plus, Search, Edit, Trash2, Download } from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import {
  fetchPatients as apiFetchPatients,
  createPatient as apiCreatePatient,
  updatePatient as apiUpdatePatient,
  deletePatient as apiDeletePatient,
  type Patient as ApiPatient,
} from '../../Api/patientsApi';
import type { Patient } from '../../types';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils';

export const PatientManagement: React.FC = () => {
  const { patients, addPatient, updatePatient, deletePatient } = useHospitalStore();
  const setPatients = useHospitalStore(state => (state as any).setPatients);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [viewingPatient, setViewingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '',
    address: '',
    emergencyContact: '',
  emergencyRelationship: '',
    emergencyPhone: '',
    medicalHistory: ''
  });

  const filteredPatients = patients.filter(patient => {
    const name = `${patient.firstName ? patient.firstName : ''} ${patient.lastName ? patient.lastName : ''}`.toLowerCase();
    const email = patient.email ? patient.email.toLowerCase() : '';
    const phone = patient.phone ? patient.phone : '';
    const search = searchTerm ? searchTerm.toLowerCase() : '';
    return (
      name.includes(search) ||
      email.includes(search) ||
      phone.includes(search)
    );
  });

  const handleOpenModal = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setFormData({
        firstName: patient.firstName,
        lastName: patient.lastName,
        email: patient.email,
        phone: patient.phone,
        dateOfBirth: patient.dateOfBirth,
        gender: patient.gender,
        address: patient.address,
        emergencyContact: patient.emergencyContact,
  // use whichever emergency relationship field exists (client-typed or server snake_case)
  emergencyRelationship: (patient as any).emergencyRelationship ?? (patient as any).emergency_contact_relationship ?? '',
        emergencyPhone: patient.emergencyPhone,
        medicalHistory: patient.medicalHistory || ''
      });
    } else {
      setEditingPatient(null);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        address: '',
  emergencyContact: '',
  emergencyRelationship: '',
  emergencyPhone: '',
        medicalHistory: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingPatient(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Basic client-side validation to avoid server 400 for required fields
    const missing: string[] = [];
    if (!formData.firstName) missing.push('First name');
    if (!formData.lastName) missing.push('Last name');
    if (!formData.phone) missing.push('Phone');
    if (!formData.dateOfBirth) missing.push('Date of birth');
    if (!formData.gender) missing.push('Gender');
    if (!formData.emergencyContact) missing.push('Emergency contact name');
    if (!formData.emergencyPhone) missing.push('Emergency contact phone');
    if (!((formData as any).emergencyRelationship)) missing.push('Emergency contact relationship');

    if (missing.length > 0) {
      // show a user-friendly message and stop submission to avoid 400
      alert(`Please provide required fields: ${missing.join(', ')}`);
      return;
    }

    const payload = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      date_of_birth: formData.dateOfBirth,
      gender: formData.gender,
      address: formData.address,
      emergency_contact_name: formData.emergencyContact,
  emergency_contact_phone: formData.emergencyPhone,
  // ensure server-required relationship is non-empty on create
  emergency_contact_relationship: formData.emergencyRelationship || 'Not specified',
      medical_history: formData.medicalHistory || null,
    };


    if (editingPatient) {
      // call API update (backend expects numeric id)
      // For PATCH, only send fields that have meaningful values (avoid empty strings)
      const patchPayload: Record<string, any> = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );

      console.debug('PATCH payload', patchPayload);
      apiUpdatePatient(Number(editingPatient.id), patchPayload)
        .then(() => {
          // update local store
          updatePatient(editingPatient.id, {
            ...formData,
            gender: formData.gender as 'male' | 'female' | 'other',
            updatedAt: new Date().toISOString(),
          });
          handleCloseModal();
        })
        .catch((err) => {
          // surface DRF validation errors if present
          console.error('Failed to update patient', err?.response?.data || err);
          // fallback: update local store anyway
          updatePatient(editingPatient.id, {
            ...formData,
            gender: formData.gender as 'male' | 'female' | 'other',
            updatedAt: new Date().toISOString(),
          });
          handleCloseModal();
        });
    } else {
      const createPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== '' && v !== null && v !== undefined)
      );

      console.debug('CREATE payload', createPayload);
      apiCreatePatient(createPayload as any)
        .then((res) => {
          // add server-returned patient to local store using server id (string)
          const newPatient: Patient = {
            id: String((res as any).id),
            firstName: res.first_name,
            lastName: res.last_name,
            email: res.email,
            phone: res.phone,
            dateOfBirth: res.date_of_birth,
            gender: (res.gender as any) || 'other',
            address: res.address,
            emergencyContact: res.emergency_contact_name,
            emergencyPhone: res.emergency_contact_phone,
            emergencyRelationship: res.emergency_contact_relationship || 'Not specified',
            medicalHistory: res.medical_history || undefined,
            createdAt: res.created_at,
            updatedAt: res.created_at,
          };

          // preserve existing patients and append the created one
          setPatients([...(patients || []), newPatient] as any);
          handleCloseModal();
        })
        .catch((err) => {
          // show server-side validation errors in console to diagnose 400
          console.error('Failed to create patient', err?.response?.data || err);
          // fallback: add locally with a generated numeric-like id string to keep id coercion safe
          addPatient({
            firstName: formData.firstName,
            lastName: formData.lastName,
            email: formData.email,
            phone: formData.phone,
            dateOfBirth: formData.dateOfBirth,
            gender: formData.gender as 'male' | 'female' | 'other',
            address: formData.address,
            emergencyContact: formData.emergencyContact,
            emergencyPhone: formData.emergencyPhone,
            emergencyRelationship: formData.emergencyRelationship || 'Not specified',
            medicalHistory: formData.medicalHistory || undefined,
          });
          handleCloseModal();
        });
    }
  };

  const handleDelete = (patientId: string) => {
    if (window.confirm('Are you sure you want to delete this patient?')) {
      // attempt backend delete then remove from store
      apiDeletePatient(Number(patientId))
        .then(() => {
          deletePatient(patientId);
        })
        .catch((err) => {
          console.error('Failed to delete patient on server', err);
          // fallback: delete locally
          deletePatient(patientId);
        });
    }
  };

  React.useEffect(() => {
    let mounted = true;
    const mapApiToClient = (p: ApiPatient): Patient => ({
      id: String(p.id),
      firstName: p.first_name,
      lastName: p.last_name,
      email: p.email,
      phone: p.phone,
      dateOfBirth: p.date_of_birth,
      gender: (p.gender as any) || 'other',
      address: p.address,
  emergencyContact: p.emergency_contact_name,
  emergencyPhone: p.emergency_contact_phone,
  emergencyRelationship: p.emergency_contact_relationship || 'Not specified',
      medicalHistory: p.medical_history || undefined,
      createdAt: p.created_at,
      updatedAt: p.created_at,
    });

    apiFetchPatients()
      .then((res) => {
        if (!mounted) return;
        const transformed = res.map(mapApiToClient);
        setPatients(transformed as any);
      })
      .catch((err) => {
        console.error('Failed to fetch patients', err);
      });

    return () => {
      mounted = false;
    };
  }, [setPatients]);

  const handleExport = (format: 'csv' | 'pdf') => {
    const dataToExport = filteredPatients.map(patient => ({
      'Full Name': `${patient.firstName} ${patient.lastName}`,
      'Email': patient.email,
      'Phone': patient.phone,
      'Gender': patient.gender,
  'Emergency Contact': patient.emergencyContact,
  'Emergency Phone': patient.emergencyPhone,
  'Emergency Relationship': (patient as any).emergencyRelationship || 'Not specified',
      'Created': formatDate(patient.createdAt)
    }));
    exportData(dataToExport, 'patients-report', format, 'Patients Report');
  };

  // Export a single patient's details as a printable PDF
  const handleExportPatient = (patient: Patient) => {
    const dataToExport = [
      {
        'Full Name': `${patient.firstName} ${patient.lastName}`,
        'Email': patient.email || 'N/A',
        'Phone': patient.phone || 'N/A',
        'Date of Birth': formatDate(patient.dateOfBirth),
        'Gender': patient.gender || 'N/A',
        'Address': patient.address || 'N/A',
        'Emergency Contact': patient.emergencyContact || 'N/A',
        'Emergency Phone': patient.emergencyPhone || 'N/A',
        'Emergency Relationship': (patient as any).emergencyRelationship || 'N/A',
        'Medical History': patient.medicalHistory || 'N/A',
        'Created': formatDate(patient.createdAt),
        'Updated': formatDate(patient.updatedAt),
      }
    ];

    exportData(dataToExport, `patient-${patient.id}`, 'pdf', `Patient — ${patient.firstName} ${patient.lastName}`);
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
  render: (_: any, patient: Patient) => (
        <div>
          <p className="font-medium">{`${patient.firstName} ${patient.lastName}`}</p>
          <p className="text-sm text-gray-500">{patient.email}</p>
        </div>
      )
    },
    {
      key: 'phone',
      header: 'Phone'
    },
    {
      key: 'gender',
      header: 'Gender',
      render: (value: string) => (
        <span className="capitalize">{value}</span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
  render: (_: any, patient: Patient) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => setViewingPatient(patient)}
            leftIcon={<Search className="w-3 h-3" />}
          >
            View
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleExportPatient(patient)}
            leftIcon={<Download className="w-3 h-3" />}
          >
            Export PDF
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleOpenModal(patient)}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() => handleDelete(patient.id)}
            leftIcon={<Trash2 className="w-3 h-3" />}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' }
  ];

  return (
  <div className="space-y-6 text-sm md:text-xs">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Patients</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage patient records and information
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
            Add Patient
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex items-center space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search patients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
        </div>

        <Table
          data={filteredPatients}
          columns={columns}
          emptyMessage="No patients found"
        />
      </Card>

      {/* Add/Edit Patient Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingPatient ? 'Edit Patient' : 'Add New Patient'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-6 text-sm md:text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="First Name"
              name="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Last Name"
              name="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              required
            />
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
            <Input
              label="Phone"
              name="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
            <Input
              label="Date of Birth"
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              required
            />
            <Select
              label="Gender"
              name="gender"
              value={formData.gender || ''}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              options={genderOptions}
              placeholder="Select gender"
              required
            />
            <Input
              label="Emergency Contact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              required
            />
            <Input
              label="Emergency Phone"
              name="emergencyPhone"
              value={formData.emergencyPhone}
              onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
              required
            />
            <Input
              label="Emergency Relationship"
              name="emergencyRelationship"
              value={(formData as any).emergencyRelationship}
              onChange={(e) => setFormData({ ...formData, emergencyRelationship: e.target.value })}
              placeholder="e.g. Spouse, Parent"
            />
          </div>

          <Input
            label="Address"
            name="address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Medical History
              </label>
              <textarea
                name="medicalHistory"
                rows={3}
                value={formData.medicalHistory}
                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:border-sky-500 focus:ring-sky-500 sm:text-sm px-3 py-2"
                placeholder="Brief medical history..."
              />
            </div>
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
              {editingPatient ? 'Update Patient' : 'Add Patient'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View details modal */}
      <Modal
        isOpen={!!viewingPatient}
        onClose={() => setViewingPatient(null)}
        title="Patient Details"
        size="medium"
      >
        {viewingPatient && (
          <div className="space-y-4 text-sm md:text-xs">
            <div>
              <p className="text-sm font-semibold">Full Name</p>
              <p className="text-sm">{`${viewingPatient.firstName} ${viewingPatient.lastName}`}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Email</p>
              <p className="text-sm">{viewingPatient.email}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Phone</p>
              <p className="text-sm">{viewingPatient.phone}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Date of Birth</p>
              <p className="text-sm">{formatDate(viewingPatient.dateOfBirth)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Gender</p>
              <p className="text-sm capitalize">{viewingPatient.gender}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Address</p>
              <p className="text-sm">{viewingPatient.address}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Emergency Contact</p>
              <p className="text-sm">{viewingPatient.emergencyContact} — {viewingPatient.emergencyPhone}</p>
              <p className="text-sm">Relationship: {(viewingPatient as any).emergencyRelationship || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm font-semibold">Medical History</p>
              <p className="text-sm">{viewingPatient.medicalHistory || 'N/A'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-semibold">Created</p>
                <p className="text-sm">{formatDate(viewingPatient.createdAt)}</p>
              </div>
              <div>
                <p className="text-sm font-semibold">Updated</p>
                <p className="text-sm">{formatDate(viewingPatient.updatedAt)}</p>
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <Button onClick={() => setViewingPatient(null)} variant="secondary">Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};