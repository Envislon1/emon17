
import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useEnergy } from '@/contexts/EnergyContext';
import { useDeviceOnlineStatus } from '@/hooks/useDeviceOnlineStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';

const GRADIENT_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', 
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
];

const CurrentValuesPieChart = () => {
  const { deviceAssignments, deviceChannels, energyReadings, selectedDeviceId } = useEnergy();
  const { isDeviceChannelOnline } = useDeviceOnlineStatus();

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
      
      // Use the hook to check if this specific device/channel is online
      const isOnline = isDeviceChannelOnline(selectedDeviceId, channelNumber);
      
      // Use channel number - 1 for consistent color indexing (House1 = index 0, House2 = index 1, etc.)
      const colorIndex = (channelNumber - 1) % GRADIENT_COLORS.length;
      
      return {
        name: channel.custom_name || `House${channelNumber}`,
        value: Number(currentValue.toFixed(2)),
        color: GRADIENT_COLORS[colorIndex],
        gradientId: `gradient-${channelNumber}`,
        isOnline,
        deviceId: selectedDeviceId,
        channelNumber: channelNumber
      };
    });
  })() : [];

  // Show ALL channels, but use a minimum value for display purposes when value is 0
  const filteredData = chartData.map(item => ({
    ...item,
    displayValue: item.value > 0 ? item.value : 0.1 // Minimum value for visibility
  }));

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
      <div className="flex flex-wrap justify-center gap-2 mt-2">
        {payload?.map((entry: any, index: number) => {
          const itemData = filteredData.find(item => item.name === entry.value);
          return (
            <div key={index} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30 text-xs">
              <div 
                className="w-2 h-2 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium text-foreground text-xs">{entry.value}</span>
              <div className={`w-1 h-1 rounded-full ${
                itemData?.isOnline ? 'bg-green-500' : 'bg-red-500'
              }`} />
            </div>
          );
        })}
      </div>
    );
  };

  if (!selectedDevice) {
    return (
      <Card className="energy-card overflow-hidden h-[500px]">
        <CardHeader>
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
    <Card className="energy-card overflow-hidden h-[500px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-energy-600 dark:text-energy-400" />
          Real-time Current Values - {selectedDevice.custom_name || selectedDevice.device_name}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        {filteredData.length > 0 ? (
          <div className="space-y-2">
            <div className="w-full h-64 animate-fade-in">
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
                        <stop offset="100%" stopColor={entry.color} stopOpacity={0.7}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <Pie
                    data={filteredData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={45}
                    paddingAngle={3}
                    dataKey="displayValue"
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
                          filter: entry.isOnline ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' : 'opacity(0.6)',
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
              <p className="text-muted-foreground font-medium">No channels configured</p>
              <p className="text-sm text-muted-foreground mt-2 max-w-xs">
                Device channels will appear when configured
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CurrentValuesPieChart;
