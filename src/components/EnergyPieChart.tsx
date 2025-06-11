
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useEnergy } from '@/contexts/EnergyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

const GRADIENT_COLORS = [
  { start: '#f97316', end: '#ea580c' }, // Orange gradient
  { start: '#3b82f6', end: '#1d4ed8' }, // Blue gradient  
  { start: '#10b981', end: '#059669' }, // Green gradient
  { start: '#8b5cf6', end: '#7c3aed' }, // Purple gradient
  { start: '#f59e0b', end: '#d97706' }, // Amber gradient
  { start: '#ef4444', end: '#dc2626' }, // Red gradient
  { start: '#06b6d4', end: '#0891b2' }, // Cyan gradient
  { start: '#84cc16', end: '#65a30d' }, // Lime gradient
];

const EnergyBarChart = () => {
  const { deviceAssignments, deviceChannels, energyReadings, totalBillSettings } = useEnergy();

  const chartData = deviceAssignments.map((device, deviceIndex) => {
    const deviceTotalBill = totalBillSettings.find(tb => tb.device_id === device.device_id);
    const totalBillAmount = deviceTotalBill?.total_bill_amount || 0;
    
    // Get all channels for this device
    const deviceChannelsList = deviceChannels.filter(ch => ch.device_id === device.device_id);
    
    // Calculate total energy for this device across all channels
    const deviceReadings = energyReadings.filter(r => r.device_id === device.device_id);
    const totalDeviceEnergy = deviceReadings.reduce((sum, reading) => sum + (reading.energy_wh || 0), 0);
    
    // Create chart entries for each channel
    return deviceChannelsList.map((channel, channelIndex) => {
      const channelReadings = deviceReadings.filter(r => r.channel_number === channel.channel_number);
      const channelEnergy = channelReadings.reduce((sum, reading) => sum + (reading.energy_wh || 0), 0);
      
      // Calculate cost: (Channel Energy / Total Device Energy) * Total Bill
      const channelCost = totalDeviceEnergy > 0 ? (channelEnergy / totalDeviceEnergy) * totalBillAmount : 0;
      
      const colorIndex = (deviceIndex * deviceChannelsList.length + channelIndex) % GRADIENT_COLORS.length;
      
      return {
        name: channel.custom_name || `House${channel.channel_number}`,
        value: Number((channelEnergy / 1000).toFixed(2)), // Convert Wh to kWh
        cost: Number(channelCost.toFixed(2)),
        color: GRADIENT_COLORS[colorIndex].start,
        gradientId: `gradient${deviceIndex}-${channelIndex}`,
        isOnline: channelReadings.length > 0,
        deviceId: device.device_id,
        channelNumber: channel.channel_number
      };
    });
  }).flat();

  // Only show channels with non-zero values
  const filteredData = chartData.filter(item => item.value > 0);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Energy: {data.value.toFixed(2)} kWh
          </p>
          <p className="text-sm text-muted-foreground">
            Cost: ₦{data.cost.toFixed(2)}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div 
              className={`w-2 h-2 rounded-full ${data.isOnline ? 'bg-green-500' : 'bg-red-500'}`}
            />
            <span className="text-xs text-muted-foreground">
              {data.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-energy-600 dark:text-energy-400" />
          Energy Consumption Chart
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredData.length > 0 ? (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <defs>
                  {filteredData.map((entry, index) => (
                    <linearGradient
                      key={entry.gradientId}
                      id={entry.gradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor={entry.color} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={entry.color} stopOpacity={0.3}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {filteredData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#${entry.gradientId})`}
                      stroke={entry.isOnline ? entry.color : '#9ca3af'}
                      strokeWidth={entry.isOnline ? 1 : 2}
                      strokeDasharray={entry.isOnline ? '0' : '5,5'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-80 flex items-center justify-center">
            <div className="text-center">
              <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No energy data available</p>
              <p className="text-sm text-muted-foreground mt-2">
                Energy consumption data will appear once devices start reporting
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnergyBarChart;
