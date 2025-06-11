import { useState, useEffect, useRef } from 'react';
import { useEnergy } from '@/contexts/EnergyContext';

interface DeviceOnlineStatus {
  [deviceId: string]: {
    [channelNumber: number]: boolean;
  };
}

export const useDeviceOnlineStatus = () => {
  const { energyReadings } = useEnergy();
  const [onlineStatus, setOnlineStatus] = useState<DeviceOnlineStatus>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to check online status for all devices/channels
  const checkOnlineStatus = () => {
    const now = Date.now();
    const timeout = 15000; // 15 seconds timeout
    const newStatus: DeviceOnlineStatus = {};

    // Group readings by device and channel
    const deviceChannels: { [key: string]: string[] } = {};
    
    energyReadings.forEach(reading => {
      const key = `${reading.device_id}_${reading.channel_number}`;
      if (!deviceChannels[reading.device_id]) {
        deviceChannels[reading.device_id] = [];
      }
      if (!deviceChannels[reading.device_id].includes(reading.channel_number.toString())) {
        deviceChannels[reading.device_id].push(reading.channel_number.toString());
      }
    });

    // Check each device/channel combination
    Object.keys(deviceChannels).forEach(deviceId => {
      newStatus[deviceId] = {};
      
      deviceChannels[deviceId].forEach(channelStr => {
        const channelNumber = parseInt(channelStr);
        
        // Find the latest reading for this channel
        const channelReadings = energyReadings
          .filter(r => r.device_id === deviceId && r.channel_number === channelNumber)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        if (channelReadings.length === 0) {
          newStatus[deviceId][channelNumber] = false;
        } else {
          const latestReading = channelReadings[0];
          const timeSinceLastReading = now - new Date(latestReading.timestamp).getTime();
          newStatus[deviceId][channelNumber] = timeSinceLastReading < timeout;
        }
      });
    });

    setOnlineStatus(newStatus);
  };

  // Helper function to check if a specific device/channel is online
  const isDeviceChannelOnline = (deviceId: string, channelNumber: number): boolean => {
    return onlineStatus[deviceId]?.[channelNumber] || false;
  };

  // Helper function to check if any channel of a device is online
  const isDeviceOnline = (deviceId: string): boolean => {
    const deviceStatus = onlineStatus[deviceId];
    if (!deviceStatus) return false;
    
    return Object.values(deviceStatus).some(isOnline => isOnline);
  };

  // Helper function to count online devices
  const getOnlineDevicesCount = (deviceIds: string[]): number => {
    return deviceIds.filter(deviceId => isDeviceOnline(deviceId)).length;
  };

  useEffect(() => {
    // Initial check
    checkOnlineStatus();

    // Set up interval to check every 2 seconds
    intervalRef.current = setInterval(checkOnlineStatus, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [energyReadings]);

  return {
    onlineStatus,
    isDeviceChannelOnline,
    isDeviceOnline,
    getOnlineDevicesCount,
    checkOnlineStatus
  };
};
