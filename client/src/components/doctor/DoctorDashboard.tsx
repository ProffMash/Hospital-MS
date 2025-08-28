import React, { useMemo, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TestTube, 
  Clock,
  TrendingUp
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useHospitalStore } from '../../store/hospitalStore';
import { Card } from '../UI/Card';
import { isToday } from '../../utils/dateUtils';

interface StatCard {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  change?: string;
}

export const DoctorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    patients, 
    appointments, 
    labOrders,
    setLabOrders
  } = useHospitalStore();

  useEffect(() => {
    // fetch lab orders if store is empty so dashboard shows correct counts on first load
    if ((!labOrders || labOrders.length === 0) && setLabOrders) {
      import('../../Api/labOrdersApi').then((mod) => {
        mod.fetchLabOrders()
          .then((data: any) => setLabOrders(data as any))
          .catch((err: any) => console.error('Failed to fetch lab orders for dashboard', err));
      }).catch((err) => console.error('Failed to load labOrdersApi', err));
    }
  }, [labOrders, setLabOrders]);

  const stats = useMemo(() => {
    const doctorAppointments = appointments.filter(apt => apt.doctorId === user?.id);
    const doctorTodayAppointments = doctorAppointments.filter(apt => isToday(apt.date));
    const doctorLabOrders = labOrders.filter(order => order.doctorId === user?.id);

    const baseStats: StatCard[] = [
      { title: 'My Patients', value: patients.length, icon: Users, color: 'bg-blue-500' },
      { title: 'Today\'s Appointments', value: doctorTodayAppointments.length, icon: Calendar, color: 'bg-purple-500' },
      { title: 'Total Appointments', value: doctorAppointments.length, icon: Clock, color: 'bg-indigo-500' },
      { title: 'Lab Orders', value: doctorLabOrders.length, icon: TestTube, color: 'bg-orange-500' }
    ];

    return baseStats;
  }, [user, patients, appointments, labOrders]);

  const recentActivities = useMemo(() => {
    const activities: Array<{ type: string; message: string; time: string; color: string }> = [];

    appointments
      .filter(apt => apt.doctorId === user?.id && isToday(apt.date))
      .slice(0, 5)
      .forEach(apt => {
        activities.push({
          type: 'appointment',
          message: `Appointment with patient`,
          time: apt.time,
          color: 'text-blue-600'
        });
      });

    return activities.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  }, [user, appointments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Doctor Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Your patient care overview
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
                    {stat.value}
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today's Schedule
            </h3>
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
                No appointments today
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quick Actions
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Calendar className="w-6 h-6 text-purple-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">View Appointments</p>
            </button>
            <button className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <TestTube className="w-6 h-6 text-orange-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Order Lab Test</p>
            </button>
            <button className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Users className="w-6 h-6 text-blue-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Patient Records</p>
            </button>
            <button className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Clock className="w-6 h-6 text-green-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Add Diagnosis</p>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};