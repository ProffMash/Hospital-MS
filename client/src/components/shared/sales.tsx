import React, { useEffect, useState, useMemo } from 'react';
import { Download, Search, Package } from 'lucide-react';
import type { Sale } from '../../Api/salesApi';
import { fetchSales, deleteSale } from '../../Api/salesApi';
import { useAuthStore } from '../../store/authStore';
import { isRole } from '../../utils/roleUtils';
import { Card } from '../UI/Card';
import { Table } from '../UI/Table';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils';

export const SalesList: React.FC = () => {

  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const user = useAuthStore(state => state.user);
  const isPharmacist = isRole(user, 'pharmacist');

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchSales();
      setSales(list);
    } catch (err) {
      console.error('Failed to fetch sales', err);
      setSales([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  load();
  }, []);

  const handleDelete = async (id: number) => {
    if (isPharmacist) {
      alert('You are not authorized to delete sales');
      return;
    }
    if (!window.confirm('Delete this sale?')) return;
    try {
      await deleteSale(id);
      setSales(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error('Failed to delete sale', err);
      alert('Failed to delete sale');
    }
  };

  

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const md = (s as any).medicine_detail;
      const medName = md?.name ? String(md.name).toLowerCase() : String(s.medicine).toLowerCase();
      const matchesSearch = !searchTerm || medName.includes(searchTerm.toLowerCase());
      const saleDate = (s.created_at || (s as any).date || '').split('T')[0];
      const matchesDate = !filterDate || saleDate === filterDate;
      return matchesSearch && matchesDate;
    });
  }, [sales, searchTerm, filterDate]);

  const handleExport = (format: 'csv' | 'pdf') => {
    const dataToExport = filteredSales.map(s => {
      const md = (s as any).medicine_detail;
      return {
        'Date': formatDate(s.created_at || (s as any).date || ''),
        'Medicine': md?.name || String(s.medicine),
        'Quantity': s.quantity,
        'Total': `$${(parseFloat(String(s.total_amount)) || 0).toFixed(2)}`,
      };
    });
    exportData(dataToExport, 'sales-report', format, 'Sales Report');
  };

  const baseColumns = [
    {
      key: 'medicine',
      header: 'Medicine',
      render: (_: any, row: Sale) => {
        const md = (row as any).medicine_detail;
        return (
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900 dark:text-white">{md?.name || String(row.medicine)}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (_: any, row: Sale) => String(row.quantity),
    },
    {
      key: 'price',
      header: 'Price',
      render: (_: any, row: Sale) => {
        const md = (row as any).medicine_detail;
        if (md?.price) return `$${(parseFloat(String(md.price)) || 0).toFixed(2)}`;
        const qty = Number(row.quantity) || 0;
        const total = parseFloat(String(row.total_amount)) || 0;
        const unit = qty > 0 ? total / qty : total;
        return `$${unit.toFixed(2)}`;
      },
    },
    {
      key: 'total',
      header: 'Total',
      render: (_: any, row: Sale) => `$${(parseFloat(String(row.total_amount)) || 0).toFixed(2)}`,
    },
    {
      key: 'date',
      header: 'Date',
      render: (_: any, row: Sale) => formatDate(row.created_at || (row as any).date || ''),
    },
  ];

  const actionsColumn = {
    key: 'actions',
    header: 'Actions',
    render: (_: any, row: Sale) => (
      <div className="flex space-x-2">
        <Button size="small" variant="danger" onClick={() => handleDelete(row.id)}>
          Delete
        </Button>
      </div>
    ),
  };

  const columns = isPharmacist ? baseColumns : [...baseColumns, actionsColumn];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Record and review pharmacy sales</p>
        </div>
        <div className="flex space-x-3">
          <Button onClick={() => handleExport('csv')} variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
            Export CSV
          </Button>
          <Button onClick={() => handleExport('pdf')} variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
            Export PDF
          </Button>
          
        </div>
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search sales by medicine..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <Input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full lg:w-48" />
          <div className="ml-auto">
            <Button onClick={load} variant="secondary" size="small">
              {loading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
        </div>

  <Table data={filteredSales} columns={columns} loading={loading} emptyMessage={loading ? 'Loading sales...' : 'No sales found'} />
      </Card>

    </div>
  );
};

export default SalesList;
