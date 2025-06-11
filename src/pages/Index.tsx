
import React from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { EnergyProvider } from '@/contexts/EnergyContext';
import Login from '@/components/Login';
import Dashboard from '@/components/Dashboard';

// Content component that uses the auth context
// This component must be inside the AuthProvider
const AppContent = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-energy-50 to-energy-100">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-energy-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-energy-600">Loading Energy Monitor...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <EnergyProvider>
      <Dashboard />
    </EnergyProvider>
  );
};

// Main Index component that provides the AuthProvider and ThemeProvider
const Index = () => {
  return (
    <AuthProvider>
      <ThemeProvider defaultTheme="light" storageKey="energy-monitor-theme">
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default Index;
