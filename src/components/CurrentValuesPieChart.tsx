import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useEnergy } from '@/contexts/EnergyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap } from 'lucide-react';

const GRADIENT_COLORS = [
  '#f97316', '#3b82f6', '#10b981', '#8b5cf6', 
  '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'
];

const CurrentValuesPieChart = () => {
  const { deviceAssignments, deviceChannels, energyReadings } = useEnergy();

  const chartData = deviceAssignments.map((device, deviceIndex) => {
    const deviceChannelsList = deviceChannels.filter(ch => ch.device_id === device.device_id);
    
    return deviceChannelsList.map((channel, channelIndex) => {
      // Get the latest reading for this channel
      const channelReadings = energyReadings
        .filter(r => r.device_id === device.device_id && r.channel_number === channel.channel_number)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const latestReading = channelReadings[0];
      const currentValue = latestReading?.current || 0;
      
      // Check if device is online (received data in last minute)
      const isOnline = latestReading ? 
        (Date.now() - new Date(latestReading.timestamp).getTime()) < 60000 : false;
      
      const colorIndex = (deviceIndex * deviceChannelsList.length + channelIndex) % GRADIENT_COLORS.length;
      
      return {
        name: channel.custom_name || `House${channel.channel_number}`,
        value: Number(currentValue.toFixed(2)),
        color: GRADIENT_COLORS[colorIndex],
        isOnline,
        deviceId: device.device_id,
        channelNumber: channel.channel_number
      };
    });
  }).flat();

  // Only show channels with values > 0 and online
  const filteredData = chartData.filter(item => item.value > 0 && item.isOnline);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-card p-3 rounded-lg shadow-lg border border-border">
          <p className="font-medium text-foreground">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            Current: {data.value.toFixed(2)} A
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${data.isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {data.isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload?.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-sm text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-energy-600 dark:text-energy-400" />
          Real-time Current Values
        </CardTitle>
      </CardHeader>
      <CardContent>
        {filteredData.length > 0 ? (
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={filteredData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={40}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {filteredData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.color}
                      stroke={entry.isOnline ? entry.color : '#9ca3af'}
                      strokeWidth={entry.isOnline ? 1 : 2}
                      strokeDasharray={entry.isOnline ? '0' : '5,5'}
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
            <div className="text-center">
              <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No active current readings</p>
              <p className="text-sm text-muted-foreground mt-2">
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