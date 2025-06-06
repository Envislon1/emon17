import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface DeviceAssignment {
  id: string;
  device_id: string;
  user_id: string;
  device_name: string;
  channel_count: number;
  custom_name: string;
  created_at: string;
}

interface DeviceChannel {
  id: string;
  device_id: string;
  channel_number: number;
  user_id: string;
  custom_name: string;
  created_at: string;
}

interface EnergyReading {
  id: string;
  device_id: string;
  channel_number: number;
  current: number;
  power: number;
  energy_wh: number;
  cost: number;
  timestamp: string;
}

interface TotalBillSetting {
  id: string;
  device_id: string;
  total_bill_amount: number;
  billing_period: string;
  updated_at: string;
  created_at: string;
}

interface EnergyResetStatus {
  session: any;
  votes: any[];
  required_votes: number;
  votes_received: number;
}

interface EnergyContextType {
  deviceAssignments: DeviceAssignment[];
  deviceChannels: DeviceChannel[];
  energyReadings: EnergyReading[];
  totalBillSettings: TotalBillSetting[];
  selectedDeviceId: string | null;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  refreshEnergyData: () => Promise<void>;
  setSelectedDeviceId: (deviceId: string | null) => void;
  assignDevice: (deviceId: string, deviceName: string, channelCount: number) => Promise<{ error?: string }>;
  updateDeviceName: (deviceId: string, deviceName: string) => Promise<{ error?: string }>;
  removeDeviceAssignment: (deviceId: string) => Promise<{ error?: string }>;
  updateTotalBill: (deviceId: string, amount: number) => Promise<{ error?: string }>;
  updateChannelName: (deviceId: string, channelNumber: number, customName: string) => Promise<{ error?: string }>;
  voteForEnergyReset: (deviceId: string) => Promise<{ error?: string; reset_triggered?: boolean }>;
  getEnergyResetStatus: (deviceId: string) => Promise<EnergyResetStatus | null>;
}

const EnergyContext = createContext<EnergyContextType | undefined>(undefined);

export const useEnergy = () => {
  const context = useContext(EnergyContext);
  if (context === undefined) {
    throw new Error('useEnergy must be used within an EnergyProvider');
  }
  return context;
};

export const EnergyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [deviceAssignments, setDeviceAssignments] = useState<DeviceAssignment[]>([]);
  const [deviceChannels, setDeviceChannels] = useState<DeviceChannel[]>([]);
  const [energyReadings, setEnergyReadings] = useState<EnergyReading[]>([]);
  const [totalBillSettings, setTotalBillSettings] = useState<TotalBillSetting[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-select first device when devices load
  useEffect(() => {
    if (deviceAssignments.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(deviceAssignments[0].device_id);
    }
  }, [deviceAssignments, selectedDeviceId]);

  const fetchData = async () => {
    if (!user) return;

    try {
      setIsLoading(true);

      // Fetch user's device assignments
      const { data: deviceAssignmentsData } = await supabase
        .from('device_assignments')
        .select('*')
        .eq('user_id', user.id);

      // Fetch user's device channels
      const { data: deviceChannelsData } = await supabase
        .from('device_channels')
        .select('*')
        .eq('user_id', user.id);

      // Fetch energy data for user's devices
      const userDeviceIds = deviceAssignmentsData?.map(d => d.device_id) || [];
      const { data: energyData } = await supabase
        .from('energy_data')
        .select('*')
        .in('device_id', userDeviceIds)
        .order('timestamp', { ascending: false });

      // Fetch total bill settings for user's devices
      const { data: totalBillData } = await supabase
        .from('total_bill_settings')
        .select('*')
        .in('device_id', userDeviceIds);

      setDeviceAssignments(deviceAssignmentsData || []);
      setDeviceChannels(deviceChannelsData || []);
      setEnergyReadings(energyData || []);
      setTotalBillSettings(totalBillData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    await fetchData();
  };

  const refreshEnergyData = async () => {
    if (!user || deviceAssignments.length === 0) return;

    try {
      // Only fetch energy data for more efficient real-time updates
      const userDeviceIds = deviceAssignments.map(d => d.device_id);

      console.log('Refreshing energy data for devices:', userDeviceIds);

      const { data: energyData } = await supabase
        .from('energy_data')
        .select('*')
        .in('device_id', userDeviceIds)
        .order('timestamp', { ascending: false });

      console.log('Fetched energy data:', energyData?.length, 'records');
      setEnergyReadings(energyData || []);
    } catch (error) {
      console.error('Error fetching energy data:', error);
    }
  };

  const assignDevice = async (deviceId: string, deviceName: string, channelCount: number) => {
    if (!user) return { error: 'No user logged in' };

    try {
      console.log('Assigning device:', deviceId, 'to user:', user.id);
      
      const { error } = await supabase
        .from('device_assignments')
        .insert({
          device_id: deviceId,
          user_id: user.id,
          device_name: deviceName,
          channel_count: channelCount,
          custom_name: deviceName
        });

      if (error) {
        console.error('Device assignment error:', error);
        return { error: error.message };
      }

      // Create device channels for this user
      const channelInserts = Array.from({ length: channelCount }, (_, i) => ({
        device_id: deviceId,
        channel_number: i + 1,
        user_id: user.id,
        custom_name: `House${i + 1}`
      }));

      const { error: channelError } = await supabase
        .from('device_channels')
        .insert(channelInserts);

      if (channelError) {
        console.log('Channel creation error (this might be OK if channels already exist):', channelError);
      }

      // Create default total bill setting for the device
      const { error: billError } = await supabase
        .from('total_bill_settings')
        .insert({
          device_id: deviceId,
          total_bill_amount: 0
        });

      if (billError) {
        console.log('Total bill setting creation error (this is OK if it already exists):', billError);
      }

      // Refresh data to ensure consistency
      await fetchData();

      return {};
    } catch (error) {
      console.error('Device assignment error:', error);
      return { error: 'Failed to assign device' };
    }
  };

  const updateDeviceName = async (deviceId: string, deviceName: string) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('device_assignments')
        .update({ device_name: deviceName, custom_name: deviceName })
        .eq('device_id', deviceId)
        .eq('user_id', user.id);

      if (error) {
        return { error: error.message };
      }

      // Update local state
      setDeviceAssignments(prev => 
        prev.map(assignment => 
          assignment.device_id === deviceId 
            ? { ...assignment, device_name: deviceName, custom_name: deviceName }
            : assignment
        )
      );

      return {};
    } catch (error) {
      return { error: 'Failed to update device name' };
    }
  };

  const removeDeviceAssignment = async (deviceId: string) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('device_assignments')
        .delete()
        .eq('device_id', deviceId)
        .eq('user_id', user.id);

      if (error) {
        return { error: error.message };
      }

      // Also remove device channels for this user
      await supabase
        .from('device_channels')
        .delete()
        .eq('device_id', deviceId)
        .eq('user_id', user.id);

      // Update local state
      setDeviceAssignments(prev => 
        prev.filter(assignment => assignment.device_id !== deviceId)
      );
      setDeviceChannels(prev =>
        prev.filter(channel => channel.device_id !== deviceId)
      );

      // If removed device was selected, select another one
      if (selectedDeviceId === deviceId) {
        const remainingDevices = deviceAssignments.filter(d => d.device_id !== deviceId);
        setSelectedDeviceId(remainingDevices.length > 0 ? remainingDevices[0].device_id : null);
      }

      return {};
    } catch (error) {
      return { error: 'Failed to remove device assignment' };
    }
  };

  const updateTotalBill = async (deviceId: string, amount: number) => {
    if (!user) return { error: 'User not authenticated' };

    try {
      console.log('Updating total bill for device:', deviceId, 'amount:', amount);
      
      // Use upsert to handle both insert and update cases
      const { data, error } = await supabase
        .from('total_bill_settings')
        .upsert({
          device_id: deviceId,
          total_bill_amount: amount,
          billing_period: 'monthly'
        }, {
          onConflict: 'device_id'
        })
        .select();

      if (error) {
        console.error('Error updating total bill:', error);
        return { error: error.message };
      }

      console.log('Total bill updated successfully:', data);
      await fetchData();
      return { error: null };
    } catch (error) {
      console.error('Error updating total bill:', error);
      return { error: 'Failed to update total bill' };
    }
  };

  const updateChannelName = async (deviceId: string, channelNumber: number, customName: string) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { error } = await supabase
        .from('device_channels')
        .update({ custom_name: customName })
        .eq('device_id', deviceId)
        .eq('channel_number', channelNumber)
        .eq('user_id', user.id);

      if (error) {
        return { error: error.message };
      }

      // Update local state
      setDeviceChannels(prev =>
        prev.map(channel =>
          channel.device_id === deviceId && channel.channel_number === channelNumber
            ? { ...channel, custom_name: customName }
            : channel
        )
      );

      return {};
    } catch (error) {
      return { error: 'Failed to update channel name' };
    }
  };

  const voteForEnergyReset = async (deviceId: string) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data, error } = await supabase.functions.invoke('energy-reset-command/vote', {
        body: { device_id: deviceId }
      });

      if (error) {
        return { error: error.message };
      }

      return { 
        error: null, 
        reset_triggered: data.reset_triggered 
      };
    } catch (error) {
      return { error: 'Failed to vote for energy reset' };
    }
  };

  const getEnergyResetStatus = async (deviceId: string): Promise<EnergyResetStatus | null> => {
    try {
      // Use GET request with query parameters by appending to the function path
      const { data, error } = await supabase.functions.invoke(`energy-reset-command/status?device_id=${deviceId}`, {
        method: 'GET'
      });

      if (error) {
        console.error('Error getting reset status:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting reset status:', error);
      return null;
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (!user || deviceAssignments.length === 0) return;

    console.log('Setting up real-time subscription and refresh interval');

    // Set up real-time subscription for energy data
    const subscription = supabase
      .channel('energy_data_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'energy_data'
      }, (payload) => {
        console.log('Real-time energy data change detected:', payload);
        refreshEnergyData();
      })
      .subscribe();

    // Set up 1-minute interval for energy data refresh
    const refreshInterval = setInterval(() => {
      console.log('Scheduled refresh of energy data');
      refreshEnergyData();
    }, 60000); // Refresh every 1 minute

    return () => {
      console.log('Cleaning up subscriptions and intervals');
      subscription.unsubscribe();
      clearInterval(refreshInterval);
    };
  }, [user, deviceAssignments.length]); // Only depend on the length, not the full array

  return (
    <EnergyContext.Provider value={{
      deviceAssignments,
      deviceChannels,
      energyReadings,
      totalBillSettings,
      selectedDeviceId,
      isLoading,
      refreshData,
      refreshEnergyData,
      setSelectedDeviceId,
      assignDevice,
      updateDeviceName,
      removeDeviceAssignment,
      updateTotalBill,
      updateChannelName,
      voteForEnergyReset,
      getEnergyResetStatus
    }}>
      {children}
    </EnergyContext.Provider>
  );
};
