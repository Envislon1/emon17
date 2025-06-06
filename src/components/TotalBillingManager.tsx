
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEnergy } from '@/contexts/EnergyContext';
import { DollarSign, Calculator, Edit3, Users, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const TotalBillingManager = () => {
  const { 
    deviceAssignments, 
    deviceChannels,
    energyReadings, 
    totalBillSettings, 
    updateTotalBill 
  } = useEnergy();
  
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [totalBill, setTotalBill] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Get current total bill for selected device
  const currentBillSetting = selectedDeviceId 
    ? totalBillSettings.find(setting => setting.device_id === selectedDeviceId)
    : null;
  const savedTotalBill = currentBillSetting?.total_bill_amount || 0;

  // Calculate total energy consumption for selected device
  const calculateTotalConsumption = (deviceId: string) => {
    if (!deviceId) return 0;
    
    return energyReadings
      .filter(reading => reading.device_id === deviceId)
      .reduce((total, reading) => total + (reading.energy_wh || 0), 0);
  };

  // Calculate proportional billing for each channel under selected device
  const calculateProportionalBilling = () => {
    if (!selectedDeviceId) return [];

    const deviceChannelsList = deviceChannels.filter(ch => ch.device_id === selectedDeviceId);
    const totalConsumption = calculateTotalConsumption(selectedDeviceId);
    
    return deviceChannelsList.map(channel => {
      const channelReadings = energyReadings.filter(reading => 
        reading.device_id === selectedDeviceId && reading.channel_number === channel.channel_number
      );
      
      const channelConsumption = channelReadings.reduce(
        (sum, reading) => sum + (reading.energy_wh || 0), 0
      );
      
      const percentage = totalConsumption > 0 ? (channelConsumption / totalConsumption) * 100 : 0;
      const proportionalAmount = totalConsumption > 0 ? (channelConsumption / totalConsumption) * savedTotalBill : 0;
      
      return {
        channel,
        consumption: channelConsumption / 1000, // Convert to kWh
        percentage: percentage,
        proportionalAmount: proportionalAmount
      };
    });
  };

  const handleUpdateTotalBill = async () => {
    if (!selectedDeviceId) {
      toast.error('Please select a device first');
      return;
    }

    const bill = parseFloat(totalBill);
    if (bill < 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await updateTotalBill(selectedDeviceId, bill);
      
      if (error) {
        toast.error('Failed to update total bill: ' + error);
      } else {
        toast.success('Total bill amount updated successfully!');
        setIsEditing(false);
        setTotalBill('');
      }
    } catch (error) {
      toast.error('Failed to update total bill');
    } finally {
      setIsUpdating(false);
    }
  };

  const proportionalData = calculateProportionalBilling();
  const totalConsumption = selectedDeviceId ? calculateTotalConsumption(selectedDeviceId) / 1000 : 0; // Convert to kWh
  const selectedDevice = deviceAssignments.find(d => d.device_id === selectedDeviceId);

  return (
    <div className="space-y-6">
      {/* Device Selection */}
      <Card className="energy-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-orange-600" />
            Total Energy Bill Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deviceAssignments.length === 0 ? (
            <div className="text-center py-8">
              <Smartphone className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-2">No devices assigned</p>
              <p className="text-sm text-muted-foreground">
                You need to assign a device first to manage billing. 
                Check the "My Devices" section to add devices.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Select Device</Label>
                <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a device to manage billing" />
                  </SelectTrigger>
                  <SelectContent>
                    {deviceAssignments.map(assignment => (
                      <SelectItem key={assignment.device_id} value={assignment.device_id}>
                        {assignment.device_name} ({assignment.device_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDeviceId && (
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Current Total Bill for {selectedDevice?.device_name}</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    {isEditing ? (
                      <div className="flex gap-2 items-center">
                        <span className="text-lg font-bold">₦</span>
                        <Input
                          type="number"
                          value={totalBill}
                          onChange={(e) => setTotalBill(e.target.value)}
                          className="w-32 h-8 text-sm"
                          placeholder="0.00"
                        />
                        <Button 
                          size="sm" 
                          onClick={handleUpdateTotalBill}
                          disabled={isUpdating}
                          className="bg-orange-600 hover:bg-orange-700"
                        >
                          {isUpdating ? 'Saving...' : 'Save'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setIsEditing(false);
                            setTotalBill('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                          ₦{savedTotalBill.toFixed(2)}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setTotalBill(savedTotalBill.toString());
                            setIsEditing(true);
                          }}
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {selectedDeviceId && (
                <div className="text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>Enter the total amount agreed to be paid for energy consumption.</p>
                  <p>Individual payments will be calculated proportionally based on usage.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Proportional Billing Breakdown */}
      {selectedDeviceId && savedTotalBill > 0 && (
        <Card className="energy-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Proportional Billing Breakdown - {selectedDevice?.device_name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <p>Total Consumption: {totalConsumption.toFixed(2)} kWh</p>
                <p>Total Bill: ₦{savedTotalBill.toFixed(2)}</p>
                <p>Device: {selectedDevice?.device_name} ({selectedDeviceId})</p>
              </div>

              {proportionalData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No channels found for this device</p>
                  <p className="text-sm mt-2">Energy consumption data will appear once channels start reporting</p>
                </div>
              ) : (
                proportionalData.map((data, index) => (
                  <div key={data.channel.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-foreground">{data.channel.custom_name}</h4>
                        <p className="text-xs text-muted-foreground">Channel {data.channel.channel_number}</p>
                      </div>
                      <span className="text-lg font-bold text-orange-600">
                        ₦{data.proportionalAmount.toFixed(2)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Consumption</p>
                        <p className="font-medium">{data.consumption.toFixed(2)} kWh</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Usage %</p>
                        <p className="font-medium">{data.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${data.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TotalBillingManager;
