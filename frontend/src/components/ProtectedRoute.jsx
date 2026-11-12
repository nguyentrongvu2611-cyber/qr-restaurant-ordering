import React from 'react';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children, allowedRole }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  if (!token || !user) return <Navigate to="/login" replace />;

  if (user.role !== allowedRole) {
    if (user.role === 'admin') return <Navigate to="/admin/menu" replace />;
    if (user.role === 'kitchen') return <Navigate to="/kitchen" replace />;
    if (user.role === 'staff') return <Navigate to="/staff" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
