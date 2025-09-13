import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useThemeStore } from './store/themeStore';
import { Layout } from './components/Layout/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { StaffPage } from './pages/Staff';
import { Appointments } from './pages/Appointments';
import { DiagnosesPage } from './pages/Diagnoses';
import { LaboratoryPage } from './pages/Laboratory';
import { InventoryPage } from './pages/Inventory';
import SalesList from './components/shared/sales';
import Profile from './components/shared/Profile';

function App() {
  const { theme } = useThemeStore();

  useEffect(() => {
    // Apply theme to document root
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    
    // Apply theme to body
    document.body.classList.remove('light', 'dark');
    document.body.classList.add(theme);
    
    // Set data attribute for better CSS targeting
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <div className={`${theme} transition-colors duration-300`}>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="patients" element={
              <ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']}>
                <Patients />
              </ProtectedRoute>
            } />
            <Route path="staff" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <StaffPage />
              </ProtectedRoute>
            } />
            <Route path="appointments" element={
              <ProtectedRoute allowedRoles={['admin', 'doctor', 'receptionist']}>
                <Appointments />
              </ProtectedRoute>
            } />
            <Route path="diagnoses" element={
              <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                <DiagnosesPage />
              </ProtectedRoute>
            } />
            <Route path="laboratory" element={
              <ProtectedRoute allowedRoles={['admin', 'doctor']}>
                <LaboratoryPage />
              </ProtectedRoute>
            } />
            <Route path="inventory" element={
              <ProtectedRoute allowedRoles={['admin', 'pharmacist']}>
                <InventoryPage />
              </ProtectedRoute>
            } />
            <Route path="profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
              <Route path="sales" element={
                <ProtectedRoute allowedRoles={["admin", "pharmacist"]}>
                  <SalesList />
                </ProtectedRoute>
              } />
            <Route path="reports" element={
              <div className="p-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Reports & Analytics</h2>
                <p className="text-gray-600 dark:text-gray-400">Reports page coming soon...</p>
              </div>
            } />
            <Route path="settings" element={
              <div className="p-6 text-center">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">System Settings</h2>
                <p className="text-gray-600 dark:text-gray-400">Settings page coming soon...</p>
              </div>
            } />
          </Route>
        </Routes>
      </Router>
    </div>
  );
}

export default App;