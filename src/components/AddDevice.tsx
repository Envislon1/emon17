
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnergy } from '@/contexts/EnergyContext';
import { Plus, Code } from 'lucide-react';
import { toast } from 'sonner';
import ESP32CodeTemplate from './ESP32CodeTemplate';

const AddDevice = () => {
  const { assignDevice } = useEnergy();
  const [systemName, setSystemName] = useState('');
  const [channelCount, setChannelCount] = useState('8');
  const [isAdding, setIsAdding] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [showCode, setShowCode] = useState(false);

  const channelOptions = [
    { value: '4', label: '4 Channels' },
    { value: '8', label: '8 Channels' },
    { value: '12', label: '12 Channels' },
    { value: '16', label: '16 Channels' }
  ];

  const generateDeviceId = () => {
    const timestamp = Date.now();
    const randomNum = Math.floor(Math.random() * 1000);
    const deviceId = `EM_${timestamp}_${randomNum}`;
    setGeneratedId(deviceId);
    return deviceId;
  };

  const handleAddSystem = async () => {
    if (!systemName.trim()) {
      toast.error('Please enter a system name');
      return;
    }

    if (!channelCount) {
      toast.error('Please select number of channels');
      return;
    }

    const deviceId = generatedId || generateDeviceId();
    setIsAdding(true);
    
    try {
      const { error } = await assignDevice(deviceId, systemName, parseInt(channelCount));

      if (error) {
        toast.error('Failed to add system: ' + error);
      } else {
        setSystemName('');
        setChannelCount('8');
        setGeneratedId('');
        toast.success(`Energy monitoring system "${systemName}" with ${channelCount} channels added successfully!`);
        setShowCode(true);
      }
    } catch (error) {
      toast.error('Failed to add energy monitoring system');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="energy-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-orange-600" />
            Add New Energy Monitoring System
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="system-name">System Name</Label>
            <Input
              id="system-name"
              type="text"
              placeholder="e.g., Building A Energy Monitor, Main Office System"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Number of Channels</Label>
            <Select value={channelCount} onValueChange={setChannelCount}>
              <SelectTrigger>
                <SelectValue placeholder="Select number of channels" />
              </SelectTrigger>
              <SelectContent>
                {channelOptions.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Device ID (for ESP32/ESP8266 Configuration)</Label>
            <div className="flex gap-2">
              <Input
                value={generatedId}
                readOnly
                placeholder="Click 'Generate ID' to create a unique device ID"
                className="bg-gray-50 dark:bg-gray-800"
              />
              <Button
                type="button"
                variant="outline"
                onClick={generateDeviceId}
                className="whitespace-nowrap"
              >
                Generate ID
              </Button>
            </div>
          </div>

          <Button 
            onClick={handleAddSystem}
            disabled={isAdding || !systemName.trim() || !generatedId || !channelCount}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {isAdding ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Adding System...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Add {channelCount}-Channel Energy System
              </>
            )}
          </Button>

          {generatedId && (
            <Button
              onClick={() => setShowCode(!showCode)}
              variant="outline"
              className="w-full"
            >
              <Code className="w-4 h-4 mr-2" />
              {showCode ? 'Hide' : 'Show'} ESP32 Code Template
            </Button>
          )}
        </CardContent>
      </Card>

      {showCode && generatedId && (
        <ESP32CodeTemplate 
          deviceId={generatedId} 
          channelCount={parseInt(channelCount)} 
        />
      )}
    </div>
  );
};

export default AddDevice;
