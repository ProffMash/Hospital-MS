import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Download, Package, AlertTriangle } from 'lucide-react';
import { useHospitalStore } from '../../store/hospitalStore';
import type { Medicine as ApiMedicine } from '../../Api/medicineApi';
import { fetchMedicines, createMedicine, updateMedicine as apiUpdateMedicine, deleteMedicine as apiDeleteMedicine, fetchMedicineById } from '../../Api/medicineApi';
import { createSale } from '../../Api/salesApi';
import { useAuthStore } from '../../store/authStore';
import { isRole } from '../../utils/roleUtils';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { Input } from '../UI/Input';
import { Table } from '../UI/Table';
import { Modal } from '../UI/Modal';
import { Select } from '../UI/Select';
import { formatDate } from '../../utils/dateUtils';
import { exportData } from '../../utils/exportUtils';

export const MedicineInventory: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const isPharmacist = isRole(user, 'pharmacist');
  const { addSale } = useHospitalStore();

  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<ApiMedicine | null>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<ApiMedicine | null>(null);
  
  // API only exposes: id, name, category, description, stock, price, created_at
  const [medicineFormData, setMedicineFormData] = useState<{
    name: string;
    category: string;
    description: string;
    stock: number;
    price: number; // UI uses number, convert to string when sending to API
  }>({
    name: '',
    category: '',
    description: '',
    stock: 0,
    price: 0
  });

  const [saleFormData, setSaleFormData] = useState({
    quantity: 1
  });
  const [isProcessingSale, setIsProcessingSale] = useState(false);

  // Fetch medicines from API on mount
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchMedicines()
      .then(data => {
        if (mounted) setMedicines(data);
      })
      .catch(err => {
        console.error('Failed to fetch medicines', err);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const filteredMedicines = useMemo(() => {
    return medicines.filter(medicine => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = medicine.name.toLowerCase().includes(q) || (medicine.description || '').toLowerCase().includes(q);
      const matchesCategory = !filterCategory || medicine.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [medicines, searchTerm, filterCategory]);


  const handleOpenModal = (medicine?: ApiMedicine) => {
    if (medicine) {
      // Prevent pharmacists from opening the edit modal
      if (isPharmacist) {
        alert('You are not authorized to edit medicines');
        return;
      }
      setEditingMedicine(medicine);
      setMedicineFormData({
        name: medicine.name,
        category: medicine.category,
        description: medicine.description || '',
        stock: medicine.stock,
        price: parseFloat(medicine.price) || 0
      });
    } else {
      setEditingMedicine(null);
      setMedicineFormData({ name: '', category: '', description: '', stock: 0, price: 0 });
    }
    setShowModal(true);
  };

  const handleOpenSaleModal = (medicine: ApiMedicine) => {
    setSelectedMedicine(medicine);
    setSaleFormData({ quantity: 1 });
    setShowSaleModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingMedicine(null);
  };

  const handleCloseSaleModal = () => {
    setShowSaleModal(false);
    setSelectedMedicine(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Prevent pharmacists from performing updates
      if (editingMedicine && isPharmacist) {
        alert('You are not authorized to update medicines');
        handleCloseModal();
        return;
      }
      if (editingMedicine) {
        const updated = await apiUpdateMedicine(editingMedicine.id, {
          name: medicineFormData.name,
          category: medicineFormData.category,
          description: medicineFormData.description,
          stock: medicineFormData.stock,
          price: String(medicineFormData.price)
        });
        setMedicines(prev => prev.map(m => (m.id === updated.id ? updated : m)));
      } else {
        const created = await createMedicine({
          name: medicineFormData.name,
          category: medicineFormData.category,
          description: medicineFormData.description,
          stock: medicineFormData.stock,
          price: String(medicineFormData.price)
        });
        setMedicines(prev => [created, ...prev]);
      }
    } catch (err) {
      console.error('Failed to save medicine', err);
      alert('Failed to save medicine');
    } finally {
      handleCloseModal();
    }
  };

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;
    if (saleFormData.quantity > selectedMedicine.stock) {
      alert('Insufficient stock quantity');
      return;
    }

    setIsProcessingSale(true);
    try {
      // Create sale on server. Backend should atomically decrement stock.
      const unitPrice = parseFloat(selectedMedicine.price) || 0;
      const totalAmount = (unitPrice * saleFormData.quantity).toFixed(2);

      const payload: any = {
        medicine: selectedMedicine.id,
        quantity: saleFormData.quantity,
        // backend Sale serializer requires `date` (YYYY-MM-DD)
        date: new Date().toISOString().split('T')[0],
        // total_amount is optional (computed server-side) but sending it avoids recomputation
        total_amount: totalAmount,
      };
      
      // create sale on server
      await createSale(payload);

      // Refresh this medicine from API to get updated stock value
      try {
        const updatedMedicine = await fetchMedicineById(selectedMedicine.id);
        setMedicines(prev => prev.map(m => (m.id === updatedMedicine.id ? updatedMedicine : m)));
      } catch (fetchErr) {
        // If fetching the single medicine fails, fall back to refetching all medicines
        console.error('Failed to fetch updated medicine, refetching list', fetchErr);
        fetchMedicines().then(data => setMedicines(data)).catch(err => console.error('Failed to refetch medicines', err));
      }

      // Map server sale into local store shape and persist locally
      const totalPrice = unitPrice * saleFormData.quantity;
      addSale({
        medicineId: String(selectedMedicine.id),
        quantity: saleFormData.quantity,
        unitPrice,
        totalPrice,
        saleDate: new Date().toISOString(),
        // customerName and saleType removed from UI; backend sale record can still contain defaults if needed
      });

      handleCloseSaleModal();
    } catch (err: any) {
      console.error('Failed to complete sale', err);
      const message = err?.response?.data || err?.message || 'Failed to complete sale';
      alert(String(message));
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handleDelete = async (medicineId: number) => {
    // Prevent pharmacists from deleting medicines
    if (isPharmacist) {
      alert('You are not authorized to delete medicines');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this medicine?')) return;
    try {
      await apiDeleteMedicine(medicineId);
      setMedicines(prev => prev.filter(m => m.id !== medicineId));
    } catch (err) {
      console.error('Failed to delete medicine', err);
      alert('Failed to delete medicine');
    }
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    const dataToExport = filteredMedicines.map(medicine => ({
      'Medicine Name': medicine.name,
      'Category': medicine.category,
      'Description': medicine.description || '',
      'Stock': medicine.stock,
      'Price': `$${(parseFloat(medicine.price) || 0).toFixed(2)}`,
      'Added On': formatDate(medicine.created_at)
    }));

    exportData(dataToExport, 'medicine-inventory-report', format, 'Medicine Inventory Report');
  };

  const columns = [
    {
      key: 'name',
      header: 'Medicine',
      render: (_: string, medicine: ApiMedicine) => (
        <div className="flex items-center space-x-2">
          <Package className="w-4 h-4 text-gray-400" />
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{medicine.name}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{medicine.description}</p>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: (_value: string, medicine: ApiMedicine) => medicine.category
    },
    {
      key: 'stock',
      header: 'Stock',
      render: (_: any, medicine: ApiMedicine) => (
        <div className="flex items-center space-x-2">
          <div>
            <p className={`font-medium ${medicine.stock <= 5 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
              {medicine.stock}
            </p>
          </div>
          {medicine.stock <= 5 && (
            <AlertTriangle className="w-4 h-4 text-red-500" />
          )}
        </div>
      )
    },
    {
      key: 'pricing',
      header: 'Pricing',
      render: (_: any, medicine: ApiMedicine) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">${(parseFloat(medicine.price) || 0).toFixed(2)}</p>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (_: any, medicine: ApiMedicine) => (
        <div className="flex space-x-2">
          <Button
            size="small"
            variant="success"
            onClick={() => handleOpenSaleModal(medicine)}
            disabled={medicine.stock === 0}
          >
            Sell
          </Button>
          {!isPharmacist && (
            <Button
              size="small"
              variant="secondary"
              onClick={() => handleOpenModal(medicine)}
              leftIcon={<Edit className="w-3 h-3" />}
            >
              Edit
            </Button>
          )}
          {!isPharmacist && (
            <Button
              size="small"
              variant="danger"
              onClick={() => handleDelete(medicine.id)}
              leftIcon={<Trash2 className="w-3 h-3" />}
            >
              Delete
            </Button>
          )}
        </div>
      )
    }
  ];

  const medicineCategories = [
    { value: '', label: 'All Categories' },
    { value: 'antibiotics', label: 'Antibiotics' },
    { value: 'analgesics', label: 'Analgesics' },
    { value: 'cardiovascular', label: 'Cardiovascular' },
    { value: 'diabetes', label: 'Diabetes' },
    { value: 'respiratory', label: 'Respiratory' },
    { value: 'gastrointestinal', label: 'Gastrointestinal' },
    { value: 'neurological', label: 'Neurological' },
    { value: 'vitamins', label: 'Vitamins & Supplements' }
  ];

  // dosageForms removed: not available in API fields and unused in this component

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Medicine Inventory</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Manage medicine stock and inventory
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            onClick={() => handleExport('csv')}
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            variant="secondary"
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export PDF
          </Button>
          <Button
            onClick={() => handleOpenModal()}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Medicine
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-blue-500">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Medicines</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventoryStats.totalMedicines}</p>
            </div>
          </div>
        </Card> */}

        {/* <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-red-500">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Low Stock</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventoryStats.lowStockCount}</p>
            </div>
          </div>
        </Card> */}

        {/* <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-orange-500">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Expiring Soon</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{inventoryStats.expiringSoonCount}</p>
            </div>
          </div>
        </Card> */}

        {/* <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-green-500">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Inventory Value</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${inventoryStats.totalInventoryValue.toFixed(2)}</p>
            </div>
          </div>
        </Card> */}

        {/* <Card className="hover:shadow-md transition-shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-emerald-500">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">${inventoryStats.totalSalesValue.toFixed(2)}</p>
            </div>
          </div>
        </Card> */}
      </div>

      <Card>
        <div className="flex flex-col lg:flex-row items-center space-y-4 lg:space-y-0 lg:space-x-4 mb-6">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search medicines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4 text-gray-400" />}
            />
          </div>
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            options={medicineCategories}
            className="w-full lg:w-48"
          />
        </div>

        <Table
          data={filteredMedicines}
          columns={columns}
          loading={loading}
          emptyMessage={loading ? 'Loading medicines...' : 'No medicines found'}
        />
      </Card>

      {/* Add/Edit Medicine Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingMedicine ? 'Edit Medicine' : 'Add Medicine'}
        size="extra-large"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Medicine Name"
              value={medicineFormData.name}
              onChange={(e) => setMedicineFormData({ ...medicineFormData, name: e.target.value })}
              required
            />
            <Select
              label="Category"
              value={medicineFormData.category}
              onChange={(e) => setMedicineFormData({ ...medicineFormData, category: e.target.value })}
              options={medicineCategories.filter(cat => cat.value !== '')}
              placeholder="Select category"
              required
            />
            <Input
              label="Stock"
              type="number"
              value={medicineFormData.stock}
              onChange={(e) => setMedicineFormData({ ...medicineFormData, stock: parseInt(e.target.value) || 0 })}
              required
            />
            <Input
              label="Price"
              type="number"
              step="0.01"
              value={medicineFormData.price}
              onChange={(e) => setMedicineFormData({ ...medicineFormData, price: parseFloat(e.target.value) || 0 })}
              required
            />
          </div>

          <Input
            label="Description"
            value={medicineFormData.description}
            onChange={(e) => setMedicineFormData({ ...medicineFormData, description: e.target.value })}
            placeholder="Brief description of the medicine"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseModal}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingMedicine ? 'Update Medicine' : 'Add Medicine'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sale Modal */}
      <Modal
        isOpen={showSaleModal}
        onClose={handleCloseSaleModal}
        title={`Sell ${selectedMedicine?.name}`}
        size="medium"
      >
        <form onSubmit={handleSaleSubmit} className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">Medicine Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500 dark:text-gray-400">Available Stock:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{selectedMedicine?.stock}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Unit Price:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">${(parseFloat(selectedMedicine?.price || '0')).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Quantity"
              type="number"
              value={saleFormData.quantity}
              onChange={(e) => setSaleFormData({ ...saleFormData, quantity: parseInt(e.target.value) || 1 })}
              min="1"
              max={selectedMedicine?.stock || 1}
              required
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="font-medium text-gray-900 dark:text-white">Total Amount:</span>
                <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ${((parseFloat(selectedMedicine?.price || '0')) * saleFormData.quantity).toFixed(2)}
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCloseSaleModal}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isProcessingSale}>
              {isProcessingSale ? 'Processing...' : 'Complete Sale'}
            </Button>
           </div>
         </form>
       </Modal>
     </div>
   );
 };