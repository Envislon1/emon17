
-- Drop existing table if it exists to recreate with new structure
DROP TABLE IF EXISTS public.ota_status_updates;

-- Create OTA status updates table for real-time progress tracking
CREATE TABLE IF NOT EXISTS public.ota_status_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  message TEXT,
  timestamp BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security
ALTER TABLE public.ota_status_updates ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view OTA status
CREATE POLICY "Users can view OTA status updates" 
  ON public.ota_status_updates 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- Create policy for service role to insert OTA status
CREATE POLICY "Service role can insert OTA status" 
  ON public.ota_status_updates 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ota_status_device_id ON public.ota_status_updates(device_id, created_at DESC);

-- Enable real-time for this table
ALTER TABLE public.ota_status_updates REPLICA IDENTITY FULL;
