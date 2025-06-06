import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEnergy } from '@/contexts/EnergyContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import EnergyOverview from './EnergyOverview';
import TotalBillingManager from './TotalBillingManager';
import CurrentValuesPieChart from './CurrentValuesPieChart';
import DeviceManager from './DeviceManager';
import { ThemeToggle } from './ThemeToggle';
import { LogOut, Zap, Activity, Smartphone } from 'lucide-react';

const Dashboard = () => {
  const { user, profile, logout } = useAuth();
  const { deviceAssignments, energyReadings, selectedDeviceId, isLoading } = useEnergy();

  // Filter data for selected device
  const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);
  const selectedDeviceReadings = energyReadings.filter(reading => reading.device_id === selectedDeviceId);

  // Calculate metrics based on selected device data
  const totalDevices = deviceAssignments.length;
  
  // Count how many devices are online (have recent data)
  const onlineDevicesCount = deviceAssignments.filter(device => {
    const deviceReadings = energyReadings.filter(r => r.device_id === device.device_id);
    if (deviceReadings.length === 0) return false;
    
    const latestReading = deviceReadings.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
    
    return (Date.now() - new Date(latestReading.timestamp).getTime()) < 60000;
  }).length;

  // Calculate total current from selected device - improved logic to handle missing readings
  const totalCurrent = selectedDevice ? (() => {
    const deviceReadings = selectedDeviceReadings;
    if (deviceReadings.length === 0) return 0;
    
    // Get all expected channels for this device
    const expectedChannels = Array.from({ length: selectedDevice.channel_count }, (_, i) => i + 1);
    
    const deviceCurrentSum = expectedChannels.reduce((deviceSum, channelNumber) => {
      const channelReadings = deviceReadings
        .filter(r => r.channel_number === channelNumber)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (channelReadings.length === 0) return deviceSum; // Channel has no readings yet
      
      const latestReading = channelReadings[0];
      // Only include if reading is recent (within last minute)
      const isRecent = (Date.now() - new Date(latestReading.timestamp).getTime()) < 60000;
      
      return deviceSum + (isRecent ? (latestReading.current || 0) : 0);
    }, 0);
    
    return deviceCurrentSum;
  })() : 0;

  // Extract first name from full name for welcome message
  const firstName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'User';

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Loading EnergyTracker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500 rounded-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">EnergyTracker</h1>
                <p className="text-muted-foreground">
                  {selectedDevice ? `Device: ${selectedDevice.custom_name || selectedDevice.device_name}` : 'Multi-Channel Systems'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="font-medium text-foreground">Welcome, {firstName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <ThemeToggle />
              <Button 
                variant="outline" 
                onClick={logout}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="energy-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Smartphone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">My Devices</p>
                  <p className="text-2xl font-bold text-foreground">{totalDevices}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="energy-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Activity className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Devices Online</p>
                  <p className="text-2xl font-bold text-green-800 dark:text-green-200">{onlineDevicesCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="energy-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Zap className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Consumption</p>
                  <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{totalCurrent.toFixed(2)} A</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Energy Overview Chart */}
            <EnergyOverview activeDevices={onlineDevicesCount} />

            {/* Total Billing Manager */}
            <TotalBillingManager />
          </div>

          {/* Right Column */}
          <div className="space-y-8">
            <CurrentValuesPieChart />
            <DeviceManager />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
