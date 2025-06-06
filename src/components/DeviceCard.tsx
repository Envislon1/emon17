
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Activity, DollarSign } from 'lucide-react';

interface Device {
  id: string;
  name: string;
  userId: string;
  currentUsage: number;
  totalEnergy: number;
  cost: number;
  isOnline: boolean;
}

interface DeviceCardProps {
  device: Device;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device }) => {
  return (
    <Card className="energy-card hover:scale-105 transition-transform duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-energy-800">
            {device.name}
          </CardTitle>
          <Badge 
            variant={device.isOnline ? "default" : "destructive"}
            className={device.isOnline ? "bg-green-500" : ""}
          >
            {device.isOnline ? "Online" : "Offline"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-energy-100 rounded-lg">
            <Activity className="w-4 h-4 text-energy-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Current Usage</p>
            <p className="font-semibold text-energy-800">
              {device.currentUsage.toFixed(2)} kW
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-energy-100 rounded-lg">
            <Zap className="w-4 h-4 text-energy-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Total Energy</p>
            <p className="font-semibold text-energy-800">
              {device.totalEnergy.toFixed(2)} kWh
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="p-2 bg-energy-100 rounded-lg">
            <DollarSign className="w-4 h-4 text-energy-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">Cost</p>
            <p className="font-semibold text-energy-800">
              ${device.cost.toFixed(2)}
            </p>
          </div>
        </div>

        {device.isOnline && (
          <div className="pt-2">
            <div className="w-full bg-energy-100 rounded-full h-2">
              <div 
                className="bg-energy-500 h-2 rounded-full animate-pulse-energy"
                style={{ width: `${Math.min((device.currentUsage / 5) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Real-time usage indicator</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceCard;
