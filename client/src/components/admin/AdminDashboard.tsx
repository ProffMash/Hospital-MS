import React, { useMemo, useEffect, useState } from 'react';
import { 
  Users, 
  Calendar, 
  TestTube, 
  TrendingUp,
  DollarSign,
  Activity,
  FileText,
  CheckCircle
} from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import { Card } from '../UI/Card';
import { isToday } from '../../utils/dateUtils';
import { getTotalRevenue, getTodaySales } from '../../Api/salesApi';

interface StatCard {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  change?: string;
  isRevenue?: boolean;
}

export const AdminDashboard: React.FC = () => {
  const { 
    patients, 
    staff, 
    appointments, 
    diagnoses,
    medicines,
    prescriptions,
    labOrders,
    sales
  } = useHospitalStore();

  const [serverTotalRevenue, setServerTotalRevenue] = useState<number | null>(null);
  const [serverTodayRevenue, setServerTodayRevenue] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const totalRes = await getTotalRevenue();
        if (!mounted) return;
        setServerTotalRevenue(totalRes.total_revenue ?? 0);
      } catch (e) {
        // ignore, keep fallback
      }

      try {
        const todayRes = await getTodaySales();
        if (!mounted) return;
        setServerTodayRevenue(todayRes.total_revenue ?? 0);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [sales]);

  const stats = useMemo(() => {
    const todayAppointments = appointments.filter(apt => isToday(apt.date));
    const pendingLabOrders = labOrders.filter(order => order.status === 'pending');
    // client-side computed fallbacks (used if server values not yet loaded)
    const totalRevenueFallback = sales.reduce((sum, sale) => sum + sale.totalPrice, 0);
    const todayRevenueFallback = sales
      .filter(sale => isToday(sale.saleDate))
      .reduce((sum, sale) => sum + sale.totalPrice, 0);

    // Prefer server-provided totals if available
    const totalRevenue = serverTotalRevenue ?? totalRevenueFallback;
    const todayRevenue = serverTodayRevenue ?? todayRevenueFallback;

    const baseStats: StatCard[] = [
      { title: 'Total Patients', value: patients.length, icon: Users, color: 'bg-blue-500' },
      { title: 'Total Staff', value: staff.length, icon: Activity, color: 'bg-green-500' },
      { title: 'Today\'s Appointments', value: todayAppointments.length, icon: Calendar, color: 'bg-purple-500' },
      { title: 'Total Diagnoses', value: diagnoses.length, icon: FileText, color: 'bg-indigo-500' },
  { title: 'Pending Lab Orders', value: pendingLabOrders.length, icon: TestTube, color: 'bg-orange-500' },
      { title: 'Total Revenue', value: totalRevenue, icon: DollarSign, color: 'bg-emerald-500', isRevenue: true },
      { title: 'Today\'s Revenue', value: todayRevenue, icon: TrendingUp, color: 'bg-cyan-500', isRevenue: true }
    ];

    return baseStats;
  }, [patients, staff, appointments, diagnoses, medicines, prescriptions, labOrders, sales, serverTotalRevenue, serverTodayRevenue]);

  const recentActivities = useMemo(() => {
    const activities: Array<{ type: string; message: string; time: string; color: string }> = [];

    // Recent appointments
    appointments
      .filter(apt => isToday(apt.date))
      .slice(0, 3)
      .forEach(apt => {
        const patient = patients.find(p => p.id === apt.patientId);
        activities.push({
          type: 'appointment',
          message: `Appointment scheduled for ${patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}`,
          time: apt.time,
          color: 'text-blue-600'
        });
      });

    // Recent diagnoses
    diagnoses
      .slice(-2)
      .forEach(diagnosis => {
        const patient = patients.find(p => p.id === diagnosis.patientId);
        activities.push({
          type: 'diagnosis',
          message: `New diagnosis recorded for ${patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}`,
          time: new Date(diagnosis.createdAt).toLocaleTimeString(),
          color: 'text-green-600'
        });
      });

    // Recent sales
    sales
      .filter(sale => isToday(sale.saleDate))
      .slice(-2)
      .forEach(sale => {
        const medicine = medicines.find(m => m.id === sale.medicineId);
        activities.push({
          type: 'sale',
          message: `${medicine?.name || 'Medicine'} sold - $${sale.totalPrice.toFixed(2)}`,
          time: new Date(sale.saleDate).toLocaleTimeString(),
          color: 'text-emerald-600'
        });
      });

    return activities.sort((a, b) => new Date(`1970-01-01T${a.time}`).getTime() - new Date(`1970-01-01T${b.time}`).getTime()).slice(0, 6);
  }, [appointments, diagnoses, sales, patients, medicines]);

  const quickStats = useMemo(() => {
    const completedAppointments = appointments.filter(apt => apt.status === 'completed').length;
    const dispensedPrescriptions = prescriptions.filter(p => p.status === 'dispensed').length;
    const completedLabOrders = labOrders.filter(order => order.status === 'completed').length;
    
    return {
      completedAppointments,
      dispensedPrescriptions,
      completedLabOrders,
      appointmentRate: appointments.length > 0 ? Math.round((completedAppointments / appointments.length) * 100) : 0,
      prescriptionRate: prescriptions.length > 0 ? Math.round((dispensedPrescriptions / prescriptions.length) * 100) : 0,
      labCompletionRate: labOrders.length > 0 ? Math.round((completedLabOrders / labOrders.length) * 100) : 0
    };
  }, [appointments, prescriptions, labOrders]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Hospital management overview and statistics
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stat.isRevenue ? `$${Number(stat.value ?? 0).toFixed(2)}` : stat.value}
                  </p>
                  {stat.change && (
                    <p className="text-xs text-green-600 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {stat.change}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Appointment Completion
            </h3>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {quickStats.completedAppointments}/{appointments.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${quickStats.appointmentRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {quickStats.appointmentRate}% completion rate
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Lab Order Completion
            </h3>
            <TestTube className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {quickStats.completedLabOrders}/{labOrders.length}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${quickStats.labCompletionRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {quickStats.labCompletionRate}% completion rate
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Activity
            </h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-2 h-2 rounded-full ${activity.color.replace('text-', 'bg-')}`}></div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {activity.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {activity.time}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No recent activity
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Status
            </h3>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-900 dark:text-white">Patient Management</span>
              </div>
              <span className="text-xs text-green-600">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-900 dark:text-white">Appointment System</span>
              </div>
              <span className="text-xs text-green-600">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-900 dark:text-white">Laboratory Services</span>
              </div>
              <span className="text-xs text-green-600">Online</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-900 dark:text-white">Pharmacy System</span>
              </div>
              <span className="text-xs text-green-600">Online</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};