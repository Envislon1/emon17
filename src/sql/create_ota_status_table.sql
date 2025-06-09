
-- Create table for OTA status updates from devices
CREATE TABLE IF NOT EXISTS public.ota_status_updates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('starting', 'downloading', 'installing', 'complete', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_ota_status_device_id ON public.ota_status_updates(device_id);
CREATE INDEX IF NOT EXISTS idx_ota_status_created_at ON public.ota_status_updates(created_at);

-- Enable RLS
ALTER TABLE public.ota_status_updates ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for authenticated users to read their device updates
CREATE POLICY "Users can view OTA updates for their devices" ON public.ota_status_updates
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.device_assignments 
    WHERE device_assignments.device_id = ota_status_updates.device_id 
    AND device_assignments.user_id = auth.uid()
  )
);

-- Allow devices to insert status updates (this would be called by the ESP32)
CREATE POLICY "Allow devices to insert OTA status updates" ON public.ota_status_updates
FOR INSERT WITH CHECK (true);

-- Enable real-time for this table
ALTER TABLE public.ota_status_updates REPLICA IDENTITY FULL;
