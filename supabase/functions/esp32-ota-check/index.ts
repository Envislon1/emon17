
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.10'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const requestData = await req.json()
    const { device_id } = requestData

    if (!device_id) {
      return new Response(
        JSON.stringify({ error: 'device_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log(`Checking for firmware updates for device: ${device_id}`)

    // Check if firmware-updates bucket exists
    const { data: buckets } = await supabaseClient.storage.listBuckets()
    const firmwareBucket = buckets?.find(bucket => bucket.name === 'firmware-updates')
    
    if (!firmwareBucket) {
      console.log('Firmware-updates bucket not found, but continuing with file check...')
      // Instead of trying to create the bucket here, just return no updates available
      // The bucket should be created through the dashboard or SQL migration
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'Firmware storage not configured. Please create the firmware-updates bucket first.'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // List firmware files for this device
    const { data: files, error: listError } = await supabaseClient.storage
      .from('firmware-updates')
      .list(`firmware/${device_id}`, {
        limit: 1,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (listError) {
      console.error('Error listing firmware files:', listError)
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'No firmware updates available'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    if (!files || files.length === 0) {
      console.log(`No firmware files found for device ${device_id}`)
      return new Response(
        JSON.stringify({ 
          has_update: false,
          message: 'No firmware updates available'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Get the latest firmware file
    const latestFirmware = files[0]
    const firmwarePath = `firmware/${device_id}/${latestFirmware.name}`

    // Get public URL for the firmware
    const { data: urlData } = supabaseClient.storage
      .from('firmware-updates')
      .getPublicUrl(firmwarePath)

    console.log(`Firmware update available for ${device_id}: ${latestFirmware.name}`)

    return new Response(
      JSON.stringify({
        has_update: true,
        firmware_url: urlData.publicUrl,
        filename: latestFirmware.name,
        file_size: latestFirmware.metadata?.size || 0,
        uploaded_at: latestFirmware.created_at
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('OTA check error:', error)
    return new Response(
      JSON.stringify({ 
        has_update: false,
        error: 'Internal server error', 
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
