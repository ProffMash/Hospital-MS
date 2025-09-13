import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Users, 
  UserPlus,
  Calendar, 
  FileText, 
  Activity, 
  TestTube,
  Package,
  ShoppingCart,
  User,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import type { UserRole } from '../../types';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

interface NavItem {
  icon: React.ComponentType<any>;
  label: string;
  path: string;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { icon: Home, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'doctor', 'pharmacist', 'receptionist'] },
  { icon: UserPlus, label: 'Patients', path: '/patients', roles: ['admin', 'doctor', 'receptionist'] },
  { icon: Users, label: 'Staff', path: '/staff', roles: ['admin'] },
  { icon: Calendar, label: 'Appointments', path: '/appointments', roles: ['admin', 'doctor', 'receptionist'] },
  { icon: FileText, label: 'Diagnoses', path: '/diagnoses', roles: ['admin', 'doctor'] },
  { icon: TestTube, label: 'Laboratory', path: '/laboratory', roles: ['admin', 'doctor'] },
  { icon: Package, label: 'Medicine Inventory', path: '/inventory', roles: ['admin', 'pharmacist'] },
  { icon: ShoppingCart, label: 'Sales', path: '/sales', roles: ['admin', 'pharmacist'] },
  { icon: User, label: 'Profile', path: '/profile', roles: ['admin', 'doctor', 'pharmacist', 'receptionist'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { user } = useAuthStore();

  const filteredNavItems = navItems.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <aside className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out ${
      collapsed ? 'w-16' : 'w-64'
    } flex flex-col h-screen`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        {!collapsed && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">HospitalMS</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300 shadow-sm'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 hover:shadow-sm'
                }`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && (
                <span className="ml-3 font-medium">{item.label}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info */}
      {!collapsed && user && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 dark:from-gray-600 dark:to-gray-800 rounded-full flex items-center justify-center shadow-sm">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {(user.name || '').charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.name}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user.role}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};