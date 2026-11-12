import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';

import Login from './pages/Auth/Login';
import ManageStaffPage from './pages/admin/ManageStaffPage';
import ManageMenuPage from './pages/admin/ManageMenuPage';
import ManageTablesPage from './pages/admin/ManageTablesPage';
import KitchenKDS from './pages/Kitchen/KDS';
import StaffMap from './pages/Staff/TableMap';
import CashierDashboard from './pages/Cashier/Dashboard';
import BarScreen from './pages/Bar/BarScreen';

const getUserRole = () => localStorage.getItem('role');
const getToken = () => localStorage.getItem('token');

const RoleRoute = ({ allowedRole, children }) => {
    const role = getUserRole();
    const token = getToken();
    if (!role || !token) return <Navigate to="/login" />;
    if (role !== allowedRole) {
        switch(role) {
            case 'admin': return <Navigate to="/admin" />;
            case 'kitchen': return <Navigate to="/kitchen" />;
            case 'staff': return <Navigate to="/staff" />;
            case 'cashier': return <Navigate to="/cashier" />;
            case 'bar': return <Navigate to="/bar" />;
            default: return <Navigate to="/login" />;
        }
    }
    return children;
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Các trang quản trị của ADMIN */}
        <Route path="/admin" element={<RoleRoute allowedRole="admin"><ManageStaffPage /></RoleRoute>} />
        <Route path="/admin/menu" element={<RoleRoute allowedRole="admin"><ManageMenuPage /></RoleRoute>} />
        <Route path="/admin/tables" element={<RoleRoute allowedRole="admin"><ManageTablesPage /></RoleRoute>} />

        {/* Điều hướng cứng theo Role */}
        <Route path="/kitchen" element={<RoleRoute allowedRole="kitchen"><KitchenKDS /></RoleRoute>} />
        <Route path="/staff" element={<RoleRoute allowedRole="staff"><StaffMap /></RoleRoute>} />
        <Route path="/cashier" element={<RoleRoute allowedRole="cashier"><CashierDashboard /></RoleRoute>} />
        <Route path="/bar" element={<RoleRoute allowedRole="bar"><BarScreen /></RoleRoute>} />

        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;