
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEnergy } from '@/contexts/EnergyContext';
import { Smartphone, Plus } from 'lucide-react';
import { toast } from 'sonner';

const AddDeviceByID = () => {
  const [deviceId, setDeviceId] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [channelCount, setChannelCount] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const { assignDevice } = useEnergy();

  const handleAssignDevice = async () => {
    if (!deviceId.trim() || !deviceName.trim()) {
      toast.error('Please enter both device ID and device name');
      return;
    }

    const channels = parseInt(channelCount);
    if (channels < 1 || channels > 16) {
      toast.error('Channel count must be between 1 and 16');
      return;
    }

    setIsLoading(true);
    const { error } = await assignDevice(deviceId.trim(), deviceName.trim(), channels);
    
    if (error) {
      toast.error(`Failed to add device: ${error}`);
    } else {
      toast.success('Device added successfully!');
      setDeviceId('');
      setDeviceName('');
      setChannelCount('1');
    }
    setIsLoading(false);
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-orange-600" />
          Add Existing Device
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="device-id">Device ID</Label>
          <Input
            id="device-id"
            placeholder="Enter device ID"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="device-name">Device Name</Label>
          <Input
            id="device-name"
            placeholder="e.g., Main House, Office Building"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="channel-count">Number of Channels</Label>
          <Input
            id="channel-count"
            type="number"
            min="1"
            max="16"
            placeholder="1"
            value={channelCount}
            onChange={(e) => setChannelCount(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Number of current sensors (1-16 channels)
          </p>
        </div>

        <Button 
          onClick={handleAssignDevice}
          disabled={isLoading}
          className="w-full bg-orange-600 hover:bg-orange-700"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Adding Device...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Add Device
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default AddDeviceByID;
