import React from 'react';
import { useAuthStore } from '../store/authStore';
import { isRole } from '../utils/roleUtils';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { DoctorDashboard } from '../components/doctor/DoctorDashboard';
import { PharmacyDashboard } from '../components/pharmacy/PharmacyDashboard';
import { ReceptionistDashboard } from '../components/Receptionist/ReceptionistDashboard';

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  if (isRole(user, 'admin')) {
    return <AdminDashboard />;
  } else if (isRole(user, 'doctor')) {
    return <DoctorDashboard />;
  } else if (isRole(user, 'pharmacist')) {
    return <PharmacyDashboard />;
  } else if (isRole(user, 'receptionist')) {
    return <ReceptionistDashboard />;
  }

  return <div>Dashboard not available for this role</div>;
};