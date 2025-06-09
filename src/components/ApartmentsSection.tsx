
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEnergy } from '@/contexts/EnergyContext';
import DeviceChannelManager from './DeviceChannelManager';
import { Building } from 'lucide-react';

const ApartmentsSection = () => {
  const { deviceAssignments } = useEnergy();

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5 text-orange-600" />
          My Devices ({deviceAssignments.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DeviceChannelManager />
      </CardContent>
    </Card>
  );
};

export default ApartmentsSection;
