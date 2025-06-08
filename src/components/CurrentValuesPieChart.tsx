
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useEnergy } from '@/contexts/EnergyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';

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

const CurrentValuesPieChart = () => {
  const { deviceAssignments, deviceChannels, energyReadings, selectedDeviceId } = useEnergy();

  // Filter for selected device only
  const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);
  const selectedDeviceChannels = deviceChannels.filter(ch => ch.device_id === selectedDeviceId);
  const selectedDeviceReadings = energyReadings.filter(r => r.device_id === selectedDeviceId);

  const chartData = selectedDevice ? (() => {
    return Array.from({ length: selectedDevice.channel_count }, (_, i) => {
      const channelNumber = i + 1;
      const channel = selectedDeviceChannels.find(ch => ch.channel_number === channelNumber) || {
        custom_name: `House${channelNumber}`,
        channel_number: channelNumber
      };

      // Get the latest reading for this channel
      const channelReadings = selectedDeviceReadings
        .filter(r => r.channel_number === channelNumber)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const latestReading = channelReadings[0];
      const currentValue = latestReading?.current || 0;
      
      // Check if device is online (received data in last minute)
      const isOnline = latestReading ? 
        (Date.now() - new Date(latestReading.timestamp).getTime()) < 60000 : false;
      
      // Use consistent color indexing - channel index directly
      const colorIndex = i % GRADIENT_COLORS.length;
      
      return {
        name: channel.custom_name || `House${channelNumber}`,
        value: Number(currentValue.toFixed(2)),
        color: GRADIENT_COLORS[colorIndex].start,
        endColor: GRADIENT_COLORS[colorIndex].end,
        gradientId: `gradient-${i}`,
        isOnline,
        deviceId: selectedDeviceId,
        channelNumber: channelNumber
      };
    });
  })() : [];

  // Show channels with values > 0 OR online status (to show real-time activity)
  const filteredData = chartData.filter(item => (item.value > 0 || item.isOnline) && item.isOnline);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-border/50 animate-fade-in">
          <p className="font-semibold text-foreground text-sm mb-2">{data.name}</p>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }}></span>
              Current: <span className="font-medium text-foreground">{data.value.toFixed(2)} A</span>
            </p>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${data.isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-xs text-muted-foreground">
                {data.isOnline ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-6">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 px-3 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors">
            <div 
              className="w-3 h-3 rounded-full shadow-sm" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs font-medium text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  if (!selectedDevice) {
    return (
      <Card className="energy-card overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-energy-50 to-energy-100 dark:from-energy-900/20 dark:to-energy-800/20">
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-energy-600 dark:text-energy-400" />
            Real-time Current Values
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="relative">
                <Zap className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <div className="absolute inset-0 w-16 h-16 mx-auto animate-pulse-energy">
                  <Zap className="w-16 h-16 text-energy-400/50" />
                </div>
              </div>
              <p className="text-muted-foreground font-medium">No device selected</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Please add a device to see real-time current values
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="energy-card overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-energy-50 to-energy-100 dark:from-energy-900/20 dark:to-energy-800/20">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-energy-600 dark:text-energy-400" />
          Real-time Current Values - {selectedDevice.custom_name || selectedDevice.device_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {filteredData.length > 0 ? (
          <div className="w-full h-80 animate-fade-in">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <defs>
                  {filteredData.map((entry, index) => (
                    <linearGradient
                      key={entry.gradientId}
                      id={entry.gradientId}
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor={entry.color} stopOpacity={0.9}/>
                      <stop offset="100%" stopColor={entry.endColor} stopOpacity={0.7}/>
                    </linearGradient>
                  ))}
                </defs>
                <Pie
                  data={filteredData}
                  cx="50%"
                  cy="50%"
                  outerRadius={110}
                  innerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                  animationBegin={0}
                  animationDuration={800}
                  animationEasing="ease-out"
                >
                  {filteredData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={`url(#${entry.gradientId})`}
                      stroke={entry.isOnline ? "rgba(255,255,255,0.8)" : '#9ca3af'}
                      strokeWidth={entry.isOnline ? 2 : 1}
                      strokeDasharray={entry.isOnline ? '0' : '4,2'}
                      style={{
                        filter: entry.isOnline ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' : 'none',
                        transition: 'all 0.3s ease'
                      }}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend content={<CustomLegend />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="w-full h-80 flex items-center justify-center">
            <div className="text-center animate-fade-in">
              <div className="relative">
                <Zap className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <div className="absolute inset-0 w-16 h-16 mx-auto animate-pulse-energy">
                  <Zap className="w-16 h-16 text-energy-400/50" />
                </div>
              </div>
              <p className="text-muted-foreground font-medium">No active current readings</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Current values will appear when devices are online and reporting
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CurrentValuesPieChart;
