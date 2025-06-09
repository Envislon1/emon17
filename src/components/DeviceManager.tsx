
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useEnergy } from '@/contexts/EnergyContext';
import AddDeviceByID from './AddDeviceByID';
import DeviceChannelManager from './DeviceChannelManager';
import EnergyResetVoting from './EnergyResetVoting';
import { Monitor } from 'lucide-react';

const DeviceManager = () => {
  const { deviceAssignments, selectedDeviceId, setSelectedDeviceId } = useEnergy();

  return (
    <div className="space-y-6">
      {/* Device Selector */}
      {deviceAssignments.length > 1 && (
        <Card className="energy-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-blue-600" />
              Select Device to View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedDeviceId || ''} onValueChange={setSelectedDeviceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a device to view" />
              </SelectTrigger>
              <SelectContent>
                {deviceAssignments.map((device) => (
                  <SelectItem key={device.device_id} value={device.device_id}>
                    {device.custom_name || device.device_name} ({device.device_id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="add-existing" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="add-existing">Add Device</TabsTrigger>
          <TabsTrigger value="manage">Manage Devices</TabsTrigger>
          <TabsTrigger value="reset">Reset Energy</TabsTrigger>
        </TabsList>
        
        <TabsContent value="add-existing" className="space-y-4">
          <AddDeviceByID />
        </TabsContent>
        
        <TabsContent value="manage" className="space-y-4">
          <DeviceChannelManager />
        </TabsContent>
        
        <TabsContent value="reset" className="space-y-4">
          <EnergyResetVoting />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DeviceManager;
