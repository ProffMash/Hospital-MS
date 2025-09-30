import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Download, Calendar, Clock, User, CheckCircle } from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import { useAuthStore } from '../../store/authStore';
import type { Appointment } from '../../types/index';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { formatDate, formatTime } from '../../utils/dateUtils';
import { isRole } from '../../utils/roleUtils';
import { exportData } from '../../utils/exportUtils'; // will be used correctly below

export const AppointmentManagement: React.FC = () => {
  const { user } = useAuthStore();
  const {
    patients,
    staff,
    appointments,
    fetchAppointments,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  } = useHospitalStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [filterDate, setFilterDate] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    doctorId: '',
    date: '',
    time: '',
    reason: '',
  status: 'scheduled',
  paymentStatus: 'not_paid'
  });

  const filteredAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      const patient = patients.find(p => p.id === appointment.patientId);
      const doctor = staff.find(s => s.id === appointment.doctorId);
      
      const matchesSearch = patient && (
        `${patient.firstName} ${patient.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (doctor && `${doctor.firstName} ${doctor.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      
      const matchesStatus = !filterStatus || appointment.status === filterStatus;
      const matchesDate = !filterDate || appointment.date === filterDate;
      
  // Filter by doctor for doctor role (use helper for case-insensitive check)
  const matchesDoctor = !isRole(user, 'doctor') || appointment.doctorId === user?.id;
      
      return matchesSearch && matchesStatus && matchesDate && matchesDoctor;
    });
  }, [appointments, patients, staff, searchTerm, filterStatus, filterDate, user]);

  // Be robust to different role casing or backend shapes: treat any role containing 'doctor' (case-insensitive) as a doctor
  const doctors = staff.filter(s => String(s.role || '').toLowerCase().includes('doctor'));

  // Helper to build a readable doctor label from staff entry supporting multiple shapes
  const formatDoctorLabel = (s: any) => {
    if (!s) return 'Unknown Doctor';
    if (s.name && String(s.name).trim()) return `Dr. ${String(s.name).trim()}`;
    const fn = s.firstName || s.first_name || '';
    const ln = s.lastName || s.last_name || '';
    const full = `${fn} ${ln}`.trim();
    if (full) return `Dr. ${full}`;
    if (s.email) return `Dr. ${s.email}`;
    return `Dr. ${s.id ?? 'Unknown'}`;
  };

  const handleOpenModal = (appointment?: Appointment) => {
    if (appointment) {
      setEditingAppointment(appointment);
      setFormData({
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        date: appointment.date,
        time: appointment.time,
  reason: appointment.reason,
  status: appointment.status,
  paymentStatus: (appointment as any).paymentStatus ?? 'not_paid',
      });
    } else {
      setEditingAppointment(null);
      const currentIsDoctor = String(user?.role || '').toLowerCase() === 'doctor';
      setFormData({
        patientId: '',
        // Default to current user when they are a doctor (case-insensitive)
        doctorId: currentIsDoctor ? (user?.id ?? '') : '',
        date: '',
        time: '',
  reason: '',
  status: 'scheduled',
  paymentStatus: 'not_paid',
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingAppointment(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  // Build handled by store methods; no local payload needed here

    if (editingAppointment) {
      updateAppointment(editingAppointment.id, {
        date: formData.date,
        time: formData.time,
        patientId: formData.patientId,
        doctorId: formData.doctorId,
    reason: formData.reason,
  status: (formData as any).status || editingAppointment.status,
  paymentStatus: (formData as any).paymentStatus as 'paid' | 'not_paid' | undefined,
      });
    } else {
      addAppointment({
        patientId: formData.patientId,
        doctorId: formData.doctorId,
        date: formData.date,
        time: formData.time,
        
        reason: formData.reason,
        status: 'scheduled',
        paymentStatus: (formData as any).paymentStatus as 'paid' | 'not_paid' | undefined,
      } as Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>);
    }

    handleCloseModal();
  };

  const handleStatusUpdate = (appointmentId: string, status: Appointment['status']) => {
  updateAppointment(appointmentId, { status });
  };

  const handleDelete = (appointmentId: string) => {
    if (window.confirm('Are you sure you want to delete this appointment?')) {
  deleteAppointment(appointmentId);
    }
  };

  const handleCancelAppointment = (appointmentId: string) => {
    // mark appointment cancelled via store (which will call API)
    updateAppointment(appointmentId, { status: 'cancelled' });
    handleCloseModal();
  };

  const handleExport = (format: 'csv' | 'pdf') => {
  const dataToExport = filteredAppointments.map(appointment => {
      const patient = patients.find(p => p.id === appointment.patientId);
      const doctor = staff.find(s => s.id === appointment.doctorId);
      
      return {
        'Date': formatDate(appointment.date),
        'Time': formatTime(appointment.time),
        'Patient': patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
        'Doctor': doctor ? formatDoctorLabel(doctor) : 'Unknown',
            'Status': appointment.status,
            'Payment Status': (appointment as any).paymentStatus || 'not_paid',
            'Reason': appointment.reason,
        'Created': formatDate(appointment.createdAt)
      };
    });
    
  exportData(dataToExport, 'appointments-report', format, 'Appointments Report');
  };

  // Export a single appointment as a printable PDF
  const handleExportAppointment = (appointment: Appointment) => {
    const patient = patients.find(p => p.id === appointment.patientId);
    const doctor = staff.find(s => s.id === appointment.doctorId);
    const dataToExport = [
      {
        'Date': formatDate(appointment.date),
        'Time': formatTime(appointment.time),
        'Patient': patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown',
        'Doctor': doctor ? formatDoctorLabel(doctor) : 'Unknown',
  'Status': appointment.status,
  'Payment Status': (appointment as any).paymentStatus || 'not_paid',
  'Reason': appointment.reason || 'N/A',
  'Created': formatDate(appointment.createdAt)
      }
    ];

    exportData(dataToExport, `appointment-${appointment.id}`, 'pdf', `Appointment — ${patient ? `${patient.firstName} ${patient.lastName}` : appointment.patientId}`);
  };

  // payment toggling removed — payment status is set on creation/edit via modal

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'completed': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
      case 'cancelled': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  const columns = [
    {
      key: 'datetime',
      header: 'Date & Time',
  render: (_: any, appointment: Appointment) => (
        <div className="flex items-center space-x-2">
          <Calendar className="w-3 h-3 text-gray-400" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {formatDate(appointment.date)}
            </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {formatTime(appointment.time)}
            </p>
          </div>
        </div>
      )
    },
    {
      key: 'patient',
      header: 'Patient',
  render: (_: any, appointment: Appointment) => {
        const patient = patients.find(p => p.id === appointment.patientId);
        return patient ? (
          <div className="flex items-center space-x-2">
            <User className="w-3 h-3 text-gray-400" />
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
  render: (_: any, appointment: Appointment) => {
        const doctor = staff.find(s => s.id === appointment.doctorId);
        return doctor ? formatDoctorLabel(doctor) : 'Unknown Doctor';
      }
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (_: any, appointment: Appointment) => (
        <span className="truncate max-w-xs">{appointment.reason || '—'}</span>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (value: string) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${getStatusColor(value)}`}>
          <span className="capitalize">{value.replace('_', ' ')}</span>
        </span>
      )
    },
    {
      key: 'payment',
      header: 'Payment',
      render: (_: any, appointment: Appointment) => (
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 rounded text-xs ${((appointment as any).paymentStatus === 'paid') ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
            {((appointment as any).paymentStatus === 'paid') ? 'Paid' : 'Not paid'}
          </span>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
  render: (_: any, appointment: Appointment) => (
        <div className="flex space-x-2">
          {appointment.status === 'scheduled' && (
            <Button
              size="small"
              variant="success"
              onClick={() => handleStatusUpdate(appointment.id, 'completed')}
              leftIcon={<CheckCircle className="w-3 h-3" />}
            >
              Mark Complete
            </Button>
          )}
          {(!isRole(user, 'receptionist') && !isRole(user, 'doctor')) && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
            <Button
              size="small"
              variant="danger"
              onClick={() => handleStatusUpdate(appointment.id, 'cancelled')}
              leftIcon={<Trash2 className="w-3 h-3" />}
            >
              Cancel
            </Button>
          )}
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleOpenModal(appointment)}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleExportAppointment(appointment)}
            leftIcon={<Download className="w-3 h-3" />}
          >
            Export PDF
          </Button>
          {(!isRole(user, 'receptionist') && !isRole(user, 'doctor')) && (
            <Button
              size="small"
              variant="danger"
              onClick={() => handleDelete(appointment.id)}
              leftIcon={<Trash2 className="w-3 h-3" />}
            >
              Delete
            </Button>
          )}
        </div>
      )
    }
  ];

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Fetch appointments from API and map to UI shape on mount
  useEffect(() => {
    setLoading(true);
    fetchAppointments().finally(() => setLoading(false));
  }, [fetchAppointments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Appointments</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage patient appointments and scheduling
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => handleExport('csv')}
            variant="secondary"
            leftIcon={<Download className="w-3 h-3" />}
          >
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            variant="secondary"
            leftIcon={<Download className="w-3 h-3" />}
          >
            Export PDF
          </Button>
          <Button
            onClick={() => handleOpenModal()}
            leftIcon={<Plus className="w-3 h-3" />}
          >
            Schedule Appointment
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search appointments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <Select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            options={statusOptions}
            className="w-full lg:w-48"
          />
          <Input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="w-full lg:w-48"
          />
        </div>

        <Table
          data={filteredAppointments}
          columns={columns}
          loading={loading}
          emptyMessage={loading ? 'Loading appointments...' : 'No appointments found'}
        />
      </Card>

      {/* Add/Edit Appointment Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingAppointment ? 'Edit Appointment' : 'Schedule New Appointment'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Patient"
              name="patientId"
              value={formData.patientId}
              onChange={(e) => setFormData({ ...formData, patientId: e.target.value })}
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
              name="doctorId"
              value={formData.doctorId}
              onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
              options={doctors.map(doctor => ({
                value: doctor.id,
                // Support both normalized { firstName, lastName } and legacy `name` field
                label: ((): string => {
                  const d: any = doctor;
                  if (d.name) return `Dr. ${d.name}`;
                  const fn = d.firstName || '';
                  const ln = d.lastName || '';
                  const full = `${fn} ${ln}`.trim();
                  return full ? `Dr. ${full}` : `Dr. ${d.email ?? d.id}`;
                })()
              }))}
              placeholder="Select doctor"
              required
              // disable choosing doctor only when the current user is a doctor (case-insensitive)
              disabled={String(user?.role || '').toLowerCase() === 'doctor'}
            />
            <Input
              label="Date"
              type="date"
              name="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
            <Input
              label="Time"
              type="time"
              name="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              required
            />
              <Select
                label="Status"
                name="status"
                value={(formData as any).status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                options={[
                  { value: 'scheduled', label: 'Scheduled' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                className="w-full"
              />
              <Select
                label="Payment Status"
                name="paymentStatus"
                value={(formData as any).paymentStatus || 'not_paid'}
                onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value })}
                options={[
                  { value: 'paid', label: 'Paid' },
                  { value: 'not_paid', label: 'Not paid' },
                ]}
                className="w-full"
              />
            {/* Duration, Type and Notes removed — backend only accepts patient, doctor, date, time, reason */}
          </div>

          <Input
            label="Reason for Visit"
            name="reason"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            placeholder="Brief description of the visit reason"
            required
          />

          {/* Notes removed to match API fields */}

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            {editingAppointment && editingAppointment.status !== 'cancelled' && editingAppointment.status !== 'completed' && (
              <Button
                type="button"
                variant="danger"
                onClick={() => handleCancelAppointment(editingAppointment.id)}
              >
                Cancel Appointment
              </Button>
            )}
            <Button type="submit">
              {editingAppointment ? 'Update Appointment' : 'Schedule Appointment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};