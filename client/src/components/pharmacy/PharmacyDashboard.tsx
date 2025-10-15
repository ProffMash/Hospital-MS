import React, { useMemo, useState, useEffect } from 'react';
import { 
  Pill, 
  TrendingUp,
  DollarSign,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import { useNavigate } from 'react-router-dom';
import { Card } from '../UI/Card';
import { fetchMedicines } from '../../Api/medicineApi';
import { getTotalRevenue, getTodaySales } from '../../Api/salesApi';

interface StatCard {
  title: string;
  value: number | string;
  icon: React.ComponentType<any>;
  color: string;
  change?: string;
  isCurrency?: boolean;
}

export const PharmacyDashboard: React.FC = () => {
  const { 
    medicines = [], 
    prescriptions = [],
    sales = []
  } = useHospitalStore();

  const [apiMedicinesCount, setApiMedicinesCount] = useState<number | null>(null);
  const [serverTotalRevenue, setServerTotalRevenue] = useState<number | null>(null);
  const [serverTodayRevenue, setServerTodayRevenue] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    fetchMedicines()
      .then(data => {
        if (mounted) setApiMedicinesCount((data || []).length);
      })
      .catch(() => {
        // ignore errors here; dashboard will fall back to store medicines length
      });

    (async () => {
      try {
        const total = await getTotalRevenue();
        if (mounted) setServerTotalRevenue(total.total_revenue ?? 0);
      } catch (e) {
        // ignore
      }

      try {
        const today = await getTodaySales();
        if (mounted) setServerTodayRevenue(today.total_revenue ?? 0);
      } catch (e) {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, []);

  const salesArr = (sales || []) as any[];

  const stats = useMemo(() => {
    // compute sales totals
    const totalSales = (sales || []).reduce((sum, s) => {
      const price = typeof s.totalPrice === 'number' ? s.totalPrice : (s.unitPrice && s.quantity ? s.unitPrice * s.quantity : 0);
      return sum + (price || 0);
    }, 0);

    const todayKey = new Date().toISOString().split('T')[0];
    const todaysSales = (sales || []).reduce((sum, s) => {
      const d = new Date(s.saleDate ?? s.createdAt).toISOString().split('T')[0];
      const price = typeof s.totalPrice === 'number' ? s.totalPrice : (s.unitPrice && s.quantity ? s.unitPrice * s.quantity : 0);
      return d === todayKey ? sum + (price || 0) : sum;
    }, 0);

    // prefer server values when available
    const totalSalesFinal = serverTotalRevenue ?? totalSales;
    const todaysSalesFinal = serverTodayRevenue ?? todaysSales;

    const baseStats: StatCard[] = [
      { title: 'Total Medicines', value: apiMedicinesCount ?? medicines.length, icon: Pill, color: 'bg-green-500' },
      { title: 'Total Sales', value: totalSalesFinal, icon: DollarSign, color: 'bg-indigo-500', isCurrency: true },
      { title: "Today's Sales", value: todaysSalesFinal, icon: Calendar, color: 'bg-blue-500', isCurrency: true },
      { title: 'Total Prescriptions', value: prescriptions.length, icon: TrendingUp, color: 'bg-purple-500' }
    ];

    return baseStats;
  }, [medicines, prescriptions, salesArr, apiMedicinesCount, serverTotalRevenue, serverTodayRevenue]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Pharmacy Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Medication management overview
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
                    {stat.isCurrency ? (typeof stat.value === 'number' ? stat.value.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) : stat.value) : stat.value}
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
              Quick Actions
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => navigate('/inventory')} className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Pill className="w-6 h-6 text-green-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Manage Inventory</p>
            </button>
            <button className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <Clock className="w-6 h-6 text-blue-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Process Prescriptions</p>
            </button>
            <button onClick={() => navigate('/inventory')} className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <AlertTriangle className="w-6 h-6 text-red-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Low Stock Alert</p>
            </button>
            <button className="p-4 text-left border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
              <CheckCircle className="w-6 h-6 text-purple-500 mb-2" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">View Reports</p>
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};