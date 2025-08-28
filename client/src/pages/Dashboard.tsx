import React from 'react';
import { useAuthStore } from '../store/authStore';
import { AdminDashboard } from '../components/admin/AdminDashboard';
import { DoctorDashboard } from '../components/doctor/DoctorDashboard';
import { PharmacyDashboard } from '../components/pharmacy/PharmacyDashboard';

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();

  if (user?.role === 'admin') {
    return <AdminDashboard />;
  } else if (user?.role === 'doctor') {
    return <DoctorDashboard />;
  } else if (user?.role === 'pharmacist') {
    return <PharmacyDashboard />;
  }

  return <div>Dashboard not available for this role</div>;
};