import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Download, UserCheck, Award } from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import type { Staff } from '../../types/index';
import * as staffApi from '../../Api/staffApi';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils'; // will be used correctly below

export const StaffManagement: React.FC = () => {
  const { staff, addStaff, updateStaff, deleteStaff } = useHospitalStore();
  const setStaff = useHospitalStore((s) => s.setStaff);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  // use API-friendly form shape: name, email, role, specialization, phone, address
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
  role: '',
    password: '',
    specialization: '',
    address: ''
  });

  const filteredStaff = staff.filter(member => {
    const matchesSearch = `${member.firstName} ${member.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.address || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = !filterRole || member.role === filterRole;
    
    return matchesSearch && matchesRole;
  });

  const handleOpenModal = (staffMember?: Staff) => {
    if (staffMember) {
      setEditingStaff(staffMember);
  setFormData({
    name: `${staffMember.firstName} ${staffMember.lastName}`.trim(),
    email: staffMember.email,
    phone: staffMember.phone,
    role: staffMember.role,
    password: '',
    specialization: staffMember.specialization || '',
  address: staffMember.address || '',
  });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
  role: '',
  password: '',
        specialization: '',
        address: '',
      });
    }
    setShowModal(true);
  };


  const handleCloseModal = () => {
    setShowModal(false);
    setEditingStaff(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    (async () => {
      try {
  if (editingStaff) {
          // Update server then local store
          const payload = {
            name: formData.name,
            email: formData.email,
            role: formData.role,
            phone: formData.phone,
            specialization: formData.specialization,
            address: formData.address,
          } as any;
          await staffApi.updateUser(Number(editingStaff.id), payload);
          // reflect in store
          // map API shape back to local Staff fields
          const names = (formData.name || '').split(' ');
          updateStaff(editingStaff.id, {
            firstName: names[0] || '',
            lastName: names.slice(1).join(' ') || '',
            email: formData.email,
            phone: formData.phone,
            role: formData.role as 'admin' | 'doctor' | 'pharmacist' | 'receptionist',
            address: formData.address,
            specialization: formData.specialization,
            updatedAt: new Date().toISOString(),
          });
  } else {
          // register creates a new user on server; create requires password — use a default temporary one
          const registerPayload = {
            email: formData.email,
            password: formData.password || 'ChangeMe123!',
            name: formData.name,
            // backend requires a role within ('admin','doctor','pharmacist') and has a default; ensure we send one
            role: formData.role || 'admin',
            specialization: formData.specialization,
            phone: formData.phone,
            address: formData.address,
          };
          try {
            await staffApi.registerUser(registerPayload as any);
          } catch (err: any) {
            // Log server validation errors and show a simple alert for now
            console.error('Register error', err);
            const fieldErrors = Object.entries(err || {}).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
            alert('Failed to register user:\n' + (fieldErrors || JSON.stringify(err)));
            return; // keep modal open so user can fix
          }
          // map server user to local Staff and add to store
          const names = (formData.name || '').split(' ');
          const newStaff: Omit<Staff, 'id' | 'createdAt' | 'updatedAt'> = {
            firstName: names[0] || '',
            lastName: names.slice(1).join(' ') || '',
            email: formData.email,
            phone: formData.phone,
            role: formData.role as 'admin' | 'doctor' | 'pharmacist' | 'receptionist',
            address: formData.address,
            specialization: formData.specialization,
          };
          addStaff(newStaff);
        }
      } catch (err) {
        console.error('Staff save error', err);
        // optionally show UI toast
      } finally {
        handleCloseModal();
      }
    })();
  };

  const handleDelete = (staffId: string) => {
    if (window.confirm('Are you sure you want to delete this staff member?')) {
      (async () => {
        try {
          await staffApi.deleteUser(Number(staffId));
        } catch (err) {
          console.error('Delete user error', err);
        } finally {
          deleteStaff(staffId);
        }
      })();
    }
  };

  // Fetch staff from backend on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const users = await staffApi.fetchUsers();
        // map backend User -> local Staff shape where possible
          const mapped: Staff[] = users.map((u) => {
          const names = (u.name || '').split(' ');
          const rr = (u.role || '').toLowerCase();
          const role = rr === 'pharmacist' ? 'pharmacist' : rr === 'doctor' ? 'doctor' : rr === 'receptionist' ? 'receptionist' : 'admin';
          return {
            id: String(u.id),
            firstName: names[0] || '',
            lastName: names.slice(1).join(' ') || '',
            email: u.email,
            phone: u.phone || '',
            role: role as 'admin' | 'doctor' | 'pharmacist' | 'receptionist',
            address: u.address || '',
            specialization: u.specialization || undefined,
            licenseNumber: undefined,
            experience: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        });
        setStaff(mapped);
      } catch (err) {
        console.error('Failed to load staff', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [setStaff]);

  const handleExport = (format: 'csv' | 'pdf') => {
    const dataToExport = filteredStaff.map(member => ({
      'Full Name': `${member.firstName} ${member.lastName}`,
      'Email': member.email,
      'Phone': member.phone,
      'Role': member.role,
      'Address': member.address,
      'Specialization': member.specialization || 'N/A',
      'Created': formatDate(member.createdAt)
    }));
    exportData(dataToExport, 'staff-report', format, 'Staff Report');
  };

  const columns = [
    {
      key: 'name',
      header: 'Name',
  render: (_: any, member: Staff) => (
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white font-medium text-xs">
              {(member.firstName || '').charAt(0)}{(member.lastName || '').charAt(0)}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {`${member.firstName} ${member.lastName}`}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
          </div>
        </div>
      )
    },
    {
      key: 'role',
      header: 'Role',
      render: (value: string) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium ${
          value === 'doctor' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300' :
          value === 'pharmacist' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
          'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
        }`}>
          {value === 'doctor' && <UserCheck className="w-3 h-3 mr-1" />}
          {value === 'pharmacist' && <Award className="w-3 h-3 mr-1" />}
          <span className="capitalize">{value.replace('_', ' ')}</span>
        </span>
      )
    },
    {
      key: 'address',
      header: 'Address'
    },
    {
      key: 'specialization',
      header: 'Specialization',
      render: (value: string) => value || 'N/A'
    },
    {
      key: 'actions',
      header: 'Actions',
  render: (_: any, member: Staff) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleOpenModal(member)}
            leftIcon={<Edit className="w-3 h-3" />}
          >
            Edit
          </Button>
          <Button
            size="small"
            variant="danger"
            onClick={() => handleDelete(member.id)}
            leftIcon={<Trash2 className="w-3 h-3" />}
          >
            Delete
          </Button>
        </div>
      )
    }
  ];

  const roleOptions = [
  { value: 'doctor', label: 'Doctor' },
  { value: 'pharmacist', label: 'Pharmacist' },
   { value: 'receptionist', label: 'Receptionist' },
   { value: 'admin', label: 'Admin' }
  ];

  // department options removed — address field is free text now

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff Management</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage hospital staff and their information
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
            Add Staff Member
          </Button>
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search staff..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <Select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            options={[
              { value: '', label: 'All Roles' },
              ...roleOptions
            ]}
            className="w-full sm:w-48"
          />
        </div>

        <Table
          data={filteredStaff}
          columns={columns}
          loading={loading}
          emptyMessage={loading ? 'Loading staff...' : 'No staff members found'}
        />
      </Card>

      {/* Add/Edit Staff Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
        size="large"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
            <Select
              label="Role"
              name="role"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              options={roleOptions}
              required
            />
            <Input
              label="Address"
              name="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Department or address"
              required
            />
            <Input
              label="Specialization"
              name="specialization"
              value={formData.specialization}
              onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
              placeholder="e.g., Cardiothoracic Surgery"
            />
            {!editingStaff && (
              <Input
                label="Password"
                type="password"
                name="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                placeholder="Temporary password"
              />
            )}
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
              {editingStaff ? 'Update Staff Member' : 'Add Staff Member'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};