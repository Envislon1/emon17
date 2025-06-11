
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, Download, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OTADownloadProgressProps {
  isOpen: boolean;
  onClose: () => void;
  deviceId: string;
  deviceName: string;
}

interface DownloadStatus {
  stage: 'waiting' | 'starting' | 'downloading' | 'installing' | 'complete' | 'failed' | 'no_update';
  progress: number;
  message: string;
}

const OTADownloadProgress: React.FC<OTADownloadProgressProps> = ({
  isOpen,
  onClose,
  deviceId,
  deviceName
}) => {
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>({
    stage: 'waiting',
    progress: 0,
    message: 'Waiting for device to start download...'
  });

  useEffect(() => {
    if (!isOpen || !deviceId) return;

    console.log('Setting up OTA download progress listener for device:', deviceId);

    const channel = supabase
      .channel(`ota-progress-${deviceId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'ota_status_updates',
          filter: `device_id=eq.${deviceId}`
        },
        (payload) => {
          console.log('Received OTA download status update:', payload);
          
          // Ensure payload.new exists and has the required fields
          if (!payload.new || typeof payload.new !== 'object') {
            console.log('Invalid payload received:', payload);
            return;
          }
          
          const { status, progress, message } = payload.new as any;
          
          let newStage: DownloadStatus['stage'] = 'waiting';
          let displayProgress = progress || 0;
          let displayMessage = message || '';
          
          switch (status) {
            case 'starting':
              newStage = 'starting';
              displayProgress = 0;
              displayMessage = message || 'Starting firmware update...';
              break;
            case 'downloading':
              newStage = 'downloading';
              displayProgress = progress || 0;
              displayMessage = message || `Downloading firmware... ${progress || 0}%`;
              break;
            case 'installing':
              newStage = 'installing';
              displayProgress = 90 + (progress || 0) / 10;
              displayMessage = 'Installing firmware... Please do not power off device';
              break;
            case 'complete':
              newStage = 'complete';
              displayProgress = 100;
              displayMessage = message || 'Firmware update completed successfully!';
              break;
            case 'failed':
              newStage = 'failed';
              displayProgress = 0;
              displayMessage = message || 'Firmware update failed';
              break;
            case 'no_update':
              newStage = 'no_update';
              displayProgress = 100;
              displayMessage = message || 'No firmware updates available';
              break;
            case 'heartbeat':
              // Don't change the stage for heartbeat, just update the message if needed
              return;
            default:
              console.log('Unknown OTA status:', status);
              return;
          }
          
          setDownloadStatus({
            stage: newStage,
            progress: displayProgress,
            message: displayMessage
          });

          // Show appropriate toasts and handle completion
          if (status === 'complete') {
            toast.success('Firmware update completed successfully!');
            setTimeout(() => {
              onClose();
            }, 3000);
          } else if (status === 'failed') {
            toast.error('Firmware update failed');
          } else if (status === 'no_update') {
            toast.info('Device is already up to date');
            setTimeout(() => {
              onClose();
            }, 3000);
          }
        }
      )
      .subscribe();

    return () => {
      console.log('Cleaning up OTA download progress listener');
      supabase.removeChannel(channel);
    };
  }, [isOpen, deviceId]); // Removed onClose from dependencies to prevent reconnections

  const getStatusIcon = () => {
    switch (downloadStatus.stage) {
      case 'downloading':
        return <Download className="w-5 h-5 text-blue-600" />;
      case 'installing':
        return <Settings className="w-5 h-5 text-orange-600 animate-spin" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
    }
  };

  const getProgressColor = () => {
    switch (downloadStatus.stage) {
      case 'downloading':
        return 'bg-blue-500';
      case 'installing':
        return 'bg-orange-500';
      case 'complete':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            Firmware Update Progress
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Updating firmware for <span className="font-medium">{deviceName}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Device ID: {deviceId}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Progress</span>
              <span className="font-medium">{downloadStatus.progress.toFixed(0)}%</span>
            </div>
            
            <Progress 
              value={downloadStatus.progress} 
              className="w-full h-2"
            />
            
            <p className="text-sm text-center text-muted-foreground">
              {downloadStatus.message}
            </p>
          </div>

          {downloadStatus.stage === 'complete' && (
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✅ Update completed! Device will restart automatically.
              </p>
            </div>
          )}

          {downloadStatus.stage === 'failed' && (
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                ❌ Update failed. Please try again.
              </p>
              <ul className="text-xs text-red-700 dark:text-red-300 list-disc list-inside space-y-1">
                <li>Check device internet connection</li>
                <li>Ensure device has sufficient storage</li>
                <li>Verify firmware file is valid</li>
              </ul>
            </div>
          )}

          {downloadStatus.stage === 'installing' && (
            <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                ⚠️ Installing firmware. Do not power off the device!
              </p>
            </div>
          )}

          {downloadStatus.stage === 'no_update' && (
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                ℹ️ Device is already running the latest firmware version.
              </p>
            </div>
          )}

          {downloadStatus.stage === 'starting' && (
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                🚀 Firmware update initiated. Preparing download...
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OTADownloadProgress;
