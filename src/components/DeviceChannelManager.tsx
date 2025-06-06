
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useEnergy } from '@/contexts/EnergyContext';
import { Edit2, Home, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const DeviceChannelManager = () => {
  const { deviceAssignments, deviceChannels, updateChannelName, removeDeviceAssignment, updateTotalBill, totalBillSettings } = useEnergy();
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [newChannelName, setNewChannelName] = useState('');
  const [editingBill, setEditingBill] = useState<string | null>(null);
  const [newBillAmount, setNewBillAmount] = useState('');

  const handleUpdateChannelName = async (deviceId: string, channelNumber: number) => {
    if (!newChannelName.trim()) {
      toast.error('Please enter a valid name');
      return;
    }

    const { error } = await updateChannelName(deviceId, channelNumber, newChannelName.trim());
    if (error) {
      toast.error(`Failed to update name: ${error}`);
    } else {
      toast.success('Channel name updated successfully!');
      setEditingChannel(null);
      setNewChannelName('');
    }
  };

  const handleUpdateTotalBill = async (deviceId: string) => {
    const amount = parseFloat(newBillAmount);
    if (isNaN(amount) || amount < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const { error } = await updateTotalBill(deviceId, amount);
    if (error) {
      toast.error(`Failed to update bill: ${error}`);
    } else {
      toast.success('Total bill updated successfully!');
      setEditingBill(null);
      setNewBillAmount('');
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (confirm('Are you sure you want to remove this device? This action cannot be undone.')) {
      const { error } = await removeDeviceAssignment(deviceId);
      if (error) {
        toast.error(`Failed to remove device: ${error}`);
      } else {
        toast.success('Device removed successfully!');
      }
    }
  };

  return (
    <div className="space-y-4">
      {deviceAssignments.map((device) => {
        const channels = deviceChannels.filter(ch => ch.device_id === device.device_id);
        const totalBill = totalBillSettings.find(tb => tb.device_id === device.device_id);

        return (
          <Card key={device.device_id} className="energy-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Home className="w-5 h-5 text-orange-600" />
                  {device.device_name}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveDevice(device.device_id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">Device ID: {device.device_id}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Total Bill Management */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Monthly Bill</span>
                  {editingBill === device.device_id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">₦</span>
                      <Input
                        type="number"
                        value={newBillAmount}
                        onChange={(e) => setNewBillAmount(e.target.value)}
                        className="w-24 h-8"
                        placeholder="0"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdateTotalBill(device.device_id)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingBill(null);
                          setNewBillAmount('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-orange-600">
                        ₦{totalBill?.total_bill_amount?.toFixed(2) || '0.00'}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingBill(device.device_id);
                          setNewBillAmount(totalBill?.total_bill_amount?.toString() || '0');
                        }}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Channels Management */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Channels ({channels.length})</h4>
                <div className="grid grid-cols-1 gap-2">
                  {channels.map((channel) => (
                    <div key={channel.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Ch{channel.channel_number}:</span>
                        {editingChannel === `${channel.device_id}-${channel.channel_number}` ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={newChannelName}
                              onChange={(e) => setNewChannelName(e.target.value)}
                              className="h-6 text-sm"
                              placeholder="Channel name"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleUpdateChannelName(channel.device_id, channel.channel_number)}
                              className="h-6 px-2"
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingChannel(null);
                                setNewChannelName('');
                              }}
                              className="h-6 px-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-medium">{channel.custom_name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingChannel(`${channel.device_id}-${channel.channel_number}`);
                                setNewChannelName(channel.custom_name);
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default DeviceChannelManager;
