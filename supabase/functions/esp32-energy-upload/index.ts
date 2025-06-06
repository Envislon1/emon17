
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
    
    const { device_id, channel_number, current, power, energy_wh, cost } = requestData

    if (!device_id || channel_number === undefined) {
      return new Response(
        JSON.stringify({ error: 'device_id and channel_number are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if device exists in device_assignments table - use limit(1) instead of single()
    // since multiple users can have access to the same device
    const { data: deviceAssignments, error: deviceError } = await supabaseClient
      .from('device_assignments')
      .select('device_id, channel_count')
      .eq('device_id', device_id)
      .limit(1)

    if (deviceError || !deviceAssignments || deviceAssignments.length === 0) {
      console.log('Device verification error:', deviceError)
      return new Response(
        JSON.stringify({ error: 'Device not registered' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const deviceAssignment = deviceAssignments[0]

    // Verify channel number is within device's channel count
    if (channel_number > deviceAssignment.channel_count || channel_number < 1) {
      return new Response(
        JSON.stringify({ error: 'Invalid channel number' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Insert energy data - ensure channel_number is always set
    const { data, error } = await supabaseClient
      .from('energy_data')
      .insert({
        device_id,
        channel_number: parseInt(channel_number),
        current: parseFloat(current) || 0,
        power: parseFloat(power) || 0,
        energy_wh: parseFloat(energy_wh) || 0,
        cost: parseFloat(cost) || 0
      })
      .select()

    if (error) {
      console.error('Insert error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to insert data', details: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    console.log('Successfully inserted energy data for device:', device_id, 'channel:', channel_number)
    
    return new Response(
      JSON.stringify({ success: true, data }),
      {
        status: 201,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      {
      status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
