
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useEnergy } from '@/contexts/EnergyContext';
import { Zap, User, UserCheck } from 'lucide-react';

interface ApartmentCardProps {
  device: {
    id: string;
    device_id: string;
    device_name: string;
    user_id: string;
    channel_count: number;
  };
}

const ApartmentCard = ({ device }: ApartmentCardProps) => {
  const { energyReadings } = useEnergy();
  
  const deviceReadings = energyReadings.filter(r => r.device_id === device.device_id);
  const latestReading = deviceReadings[0];

  const isOnline = deviceReadings.length > 0;

  return (
    <Card className="energy-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            {device.device_name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-xs">
              <UserCheck className="w-3 h-3 mr-1" />
              {device.channel_count} Channels
            </Badge>
            <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
              <div className={`w-2 h-2 rounded-full mr-1 ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Device ID: {device.device_id}</span>
            <Zap className="w-4 h-4 text-energy-500" />
          </div>
          
          {latestReading ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current</p>
                <p className="font-medium">{latestReading.current?.toFixed(2) || '0.00'} A</p>
              </div>
              <div>
                <p className="text-muted-foreground">Power</p>
                <p className="font-medium">{latestReading.power?.toFixed(2) || '0.00'} kW</p>
              </div>
              <div>
                <p className="text-muted-foreground">Energy</p>
                <p className="font-medium">{((latestReading.energy_wh || 0) / 1000).toFixed(2)} kWh</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cost</p>
                <p className="font-medium text-energy-600">₦{latestReading.cost?.toFixed(2) || '0.00'}</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No energy data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApartmentCard;
