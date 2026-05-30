import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import './index.css';
import App from './App';
import LoginPage from './LoginPage';
import ProtectedRoute from './ProtectedRoute';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Toaster position="bottom-right" richColors />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/*" element={<ProtectedRoute><App /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
