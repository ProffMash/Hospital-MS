import React, { useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  Clock,
  UserPlus,
  CalendarPlus,
  TrendingUp,
  CheckCircle
} from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { isToday } from '../../utils/dateUtils';

interface StatCard {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  change?: string;
}

export const ReceptionistDashboard: React.FC = () => {
  const { 
    patients, 
    appointments
  } = useHospitalStore();

  const stats = useMemo(() => {
    const todayAppointments = appointments.filter(apt => isToday(apt.date));
    const scheduledAppointments = appointments.filter(apt => apt.status === 'scheduled');
    const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed');
    const recentPatients = patients.filter(patient => {
      const createdDate = new Date(patient.createdAt);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return createdDate >= weekAgo;
    });

    const baseStats: StatCard[] = [
      { title: 'Total Patients', value: patients.length, icon: Users, color: 'bg-blue-500' },
      { title: 'New Patients (7 days)', value: recentPatients.length, icon: UserPlus, color: 'bg-green-500' },
      { title: 'Today\'s Appointments', value: todayAppointments.length, icon: Calendar, color: 'bg-purple-500' },
      { title: 'Scheduled Appointments', value: scheduledAppointments.length, icon: Clock, color: 'bg-orange-500' },
      { title: 'Confirmed Appointments', value: confirmedAppointments.length, icon: CheckCircle, color: 'bg-emerald-500' },
      { title: 'Total Appointments', value: appointments.length, icon: CalendarPlus, color: 'bg-indigo-500' }
    ];

    return baseStats;
  }, [patients, appointments]);

  const todaySchedule = useMemo(() => {
    return appointments
      .filter(apt => isToday(apt.date))
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 8); // Show first 8 appointments
  }, [appointments]);

  const recentPatients = useMemo(() => {
    return patients
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6); // Show 6 most recent patients
  }, [patients]);

  const appointmentStats = useMemo(() => {
    const total = appointments.length;
    const scheduled = appointments.filter(apt => apt.status === 'scheduled').length;
    const confirmed = appointments.filter(apt => apt.status === 'confirmed').length;
    const completed = appointments.filter(apt => apt.status === 'completed').length;
    
    return {
      total,
      scheduled,
      confirmed,
      completed,
      scheduledRate: total > 0 ? Math.round((scheduled / total) * 100) : 0,
      confirmedRate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      completedRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reception Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Patient registration and appointment scheduling overview
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => window.location.href = '/patients'}
            leftIcon={<UserPlus className="w-4 h-4" />}
          >
            Add Patient
          </Button>
          <Button
            onClick={() => window.location.href = '/appointments'}
            leftIcon={<CalendarPlus className="w-4 h-4" />}
          >
            Schedule Appointment
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

      {/* Appointment Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Scheduled Appointments
            </h3>
            <Clock className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Scheduled</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {appointmentStats.scheduled}/{appointmentStats.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${appointmentStats.scheduledRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {appointmentStats.scheduledRate}% of total appointments
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Confirmed Appointments
            </h3>
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Confirmed</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {appointmentStats.confirmed}/{appointmentStats.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${appointmentStats.confirmedRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {appointmentStats.confirmedRate}% confirmation rate
            </p>
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Completed Appointments
            </h3>
            <CheckCircle className="w-5 h-5 text-blue-500" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">Completed</span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {appointmentStats.completed}/{appointmentStats.total}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${appointmentStats.completedRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {appointmentStats.completedRate}% completion rate
            </p>
          </div>
        </Card>
      </div>

      {/* Today's Schedule and Recent Patients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Today's Schedule
            </h3>
            <Calendar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {todaySchedule.length > 0 ? (
              todaySchedule.map((appointment, index) => {
                const patient = patients.find(p => p.id === appointment.patientId);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {appointment.type.replace('_', ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {appointment.time}
                      </p>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        appointment.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                        appointment.status === 'confirmed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
                      }`}>
                        {appointment.status}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No appointments scheduled for today
              </p>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Patients
            </h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentPatients.length > 0 ? (
              recentPatients.map((patient, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-medium text-sm">
                      {(patient.firstName || '').charAt(0)}{(patient.lastName || '').charAt(0)}
                    </span>
                    </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {`${patient.firstName} ${patient.lastName}`}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {patient.email}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(patient.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                No recent patients
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Quick Actions
          </h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => window.location.href = '/patients'}
            className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <UserPlus className="w-6 h-6 text-blue-500 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Add New Patient</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Register new patient</p>
          </button>
          <button 
            onClick={() => window.location.href = '/appointments'}
            className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <CalendarPlus className="w-6 h-6 text-green-500 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">Schedule Appointment</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Book new appointment</p>
          </button>
          <button 
            onClick={() => window.location.href = '/patients'}
            className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Users className="w-6 h-6 text-purple-500 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">View Patients</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Browse patient records</p>
          </button>
          <button 
            onClick={() => window.location.href = '/appointments'}
            className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Calendar className="w-6 h-6 text-orange-500 mb-2" />
            <p className="text-sm font-medium text-gray-900 dark:text-white">View Schedule</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Check appointments</p>
          </button>
        </div>
      </Card>
    </div>
  );
};