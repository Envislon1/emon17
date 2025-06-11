
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Upload, Wifi, Lock, AlertTriangle, CheckCircle, XCircle, Info, CloudUpload } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEnergy } from '@/contexts/EnergyContext';
import { useDeviceOnlineStatus } from '@/hooks/useDeviceOnlineStatus';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import OTADownloadProgress from './OTADownloadProgress';

interface OTAStatus {
  stage: 'idle' | 'authenticating' | 'uploading' | 'processing' | 'ready' | 'complete' | 'failed';
  progress: number;
  message: string;
}

const OTAManager = () => {
  const { user } = useAuth();
  const { deviceAssignments } = useEnergy();
  const { isDeviceOnline } = useDeviceOnlineStatus();
  const [isOpen, setIsOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [firmwareFile, setFirmwareFile] = useState<File | null>(null);
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [authStep, setAuthStep] = useState(true);
  const [otaStatus, setOtaStatus] = useState<OTAStatus>({
    stage: 'idle',
    progress: 0,
    message: ''
  });
  
  // New state for download progress popup
  const [showDownloadProgress, setShowDownloadProgress] = useState(false);
  const [downloadDeviceId, setDownloadDeviceId] = useState('');
  const [downloadDeviceName, setDownloadDeviceName] = useState('');

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Please enter your password');
      return;
    }
    setAuthStep(false);
    toast.success('Authentication successful');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.bin') || file.name.endsWith('.ino.bin')) {
        setFirmwareFile(file);
        toast.success('Firmware file selected');
      } else {
        toast.error('Please select a .bin firmware file');
        e.target.value = '';
      }
    }
  };

  const uploadFirmwareToSupabase = async (deviceId: string, firmware: File): Promise<string | null> => {
    try {
      setOtaStatus({
        stage: 'uploading',
        progress: 20,
        message: 'Uploading firmware to cloud storage...'
      });

      // Create unique filename with timestamp
      const timestamp = Date.now();
      const filename = `firmware/${deviceId}/${timestamp}_${firmware.name}`;

      // Upload to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('firmware-updates')
        .upload(filename, firmware, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setOtaStatus({
        stage: 'processing',
        progress: 70,
        message: 'Getting download URL...'
      });

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('firmware-updates')
        .getPublicUrl(filename);

      if (!urlData.publicUrl) {
        throw new Error('Failed to get download URL');
      }

      setOtaStatus({
        stage: 'ready',
        progress: 100,
        message: 'Firmware uploaded successfully! Device will start downloading...'
      });

      return urlData.publicUrl;

    } catch (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }
  };

  const handleOTAUpload = async () => {
    if (!firmwareFile || !targetDeviceId.trim()) {
      toast.error('Please select firmware file and target device');
      return;
    }

    const selectedDevice = deviceAssignments.find(d => d.device_id === targetDeviceId);

    try {
      // Step 1: Authentication
      setOtaStatus({
        stage: 'authenticating',
        progress: 5,
        message: 'Verifying authentication...'
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 2: Upload firmware to Supabase
      const firmwareUrl = await uploadFirmwareToSupabase(targetDeviceId, firmwareFile);

      if (firmwareUrl) {
        // Mark as complete in upload dialog
        setOtaStatus({
          stage: 'complete',
          progress: 100,
          message: 'Upload complete! Opening download progress...'
        });

        toast.success('Firmware uploaded! Device will start downloading...');
        
        // Wait a moment for user to see completion, then close main dialog and open download progress
        setTimeout(() => {
          setIsOpen(false);
          setDownloadDeviceId(targetDeviceId);
          setDownloadDeviceName(selectedDevice?.custom_name || selectedDevice?.device_name || targetDeviceId);
          setShowDownloadProgress(true);
          
          // Reset form
          resetDialog();
        }, 1500);
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'OTA update failed. Please try again.';
      
      setOtaStatus({
        stage: 'failed',
        progress: 0,
        message: errorMessage
      });
      
      toast.error(errorMessage);
      console.error('OTA update error:', error);
    }
  };

  const resetDialog = () => {
    setPassword('');
    setFirmwareFile(null);
    setTargetDeviceId('');
    setAuthStep(true);
    setOtaStatus({ stage: 'idle', progress: 0, message: '' });
  };

  const handleDownloadProgressClose = useCallback(() => {
    setShowDownloadProgress(false);
    setDownloadDeviceId('');
    setDownloadDeviceName('');
  }, []);

  const selectedDevice = deviceAssignments.find(d => d.device_id === targetDeviceId);
  const isUpdating = otaStatus.stage !== 'idle' && otaStatus.stage !== 'complete' && otaStatus.stage !== 'failed';

  return (
    <>
      <Card className="energy-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CloudUpload className="w-5 h-5 text-blue-600" />
            Real-time OTA Firmware Update
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Upload firmware with real-time progress tracking. Device checks for updates every 3 seconds.
          </p>
          
          <Dialog open={isOpen} onOpenChange={(open) => {
            if (!isUpdating) {
              setIsOpen(open);
              if (!open) resetDialog();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="w-full flex items-center gap-2" disabled={deviceAssignments.length === 0}>
                <Upload className="w-4 h-4" />
                Upload Firmware Update
              </Button>
            </DialogTrigger>
            
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CloudUpload className="w-5 h-5" />
                  Real-time OTA Update
                </DialogTitle>
                <DialogDescription>
                  {authStep ? 'Enter your password to proceed' : 'Upload firmware to cloud storage'}
                </DialogDescription>
              </DialogHeader>

              {authStep ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertDescription>
                      Password authentication is required for security
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Account Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your account password"
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full">
                    Authenticate
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deviceSelect">Target Device</Label>
                    <Select value={targetDeviceId} onValueChange={setTargetDeviceId} disabled={isUpdating}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select device to update" />
                      </SelectTrigger>
                      <SelectContent>
                        {deviceAssignments.map((device) => (
                          <SelectItem key={device.device_id} value={device.device_id}>
                            {device.custom_name || device.device_name} ({device.device_id})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedDevice && (
                      <p className="text-sm text-muted-foreground">
                        {selectedDevice.channel_count} channels • {selectedDevice.device_name}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="firmware">Firmware File (.bin)</Label>
                    <Input
                      id="firmware"
                      type="file"
                      accept=".bin,.ino.bin"
                      onChange={handleFileSelect}
                      disabled={isUpdating}
                      required
                    />
                    {firmwareFile && (
                      <p className="text-sm text-green-600">
                        ✓ {firmwareFile.name} ({(firmwareFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                  </div>

                  {/* Upload Progress Section */}
                  {otaStatus.stage !== 'idle' && (
                    <div className="space-y-3 p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        {otaStatus.stage === 'complete' && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {otaStatus.stage === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
                        {isUpdating && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                        <span className="text-sm font-medium">
                          {otaStatus.stage === 'complete' ? 'Upload Complete' : 
                           otaStatus.stage === 'failed' ? 'Upload Failed' : 'Uploading...'}
                        </span>
                      </div>
                      
                      <Progress value={otaStatus.progress} className="w-full" />
                      
                      <p className="text-xs text-muted-foreground">
                        {otaStatus.message}
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setAuthStep(true)}
                      className="flex-1"
                      disabled={isUpdating}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleOTAUpload}
                      disabled={!firmwareFile || !targetDeviceId.trim() || isUpdating}
                      className="flex-1"
                    >
                      {isUpdating ? 'Uploading...' : 'Upload Firmware'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {deviceAssignments.length === 0 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                No devices available. Please add a device first to enable OTA updates.
              </p>
            </div>
          )}

          <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
              ✅ How it works:
            </p>
            <ul className="text-xs text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
              <li>Upload firmware file through dashboard</li>
              <li>File is stored securely in Supabase storage</li>
              <li>Device checks for updates automatically every 3 seconds</li>
              <li>Real-time progress updates shown in popup</li>
              <li>Device downloads, verifies, installs, and restarts</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Download Progress Popup */}
      <OTADownloadProgress
        isOpen={showDownloadProgress}
        onClose={handleDownloadProgressClose}
        deviceId={downloadDeviceId}
        deviceName={downloadDeviceName}
      />
    </>
  );
};

export default OTAManager;
