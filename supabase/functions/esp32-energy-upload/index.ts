
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
    
    const { device_id, channel_number, current, power, energy_wh } = requestData

    if (!device_id || channel_number === undefined) {
      return new Response(
        JSON.stringify({ error: 'device_id and channel_number are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Check if device exists in device_assignments table
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

    // Get total bill for cost calculation
    const { data: totalBillData } = await supabaseClient
      .from('total_bill_settings')
      .select('total_bill_amount')
      .eq('device_id', device_id)
      .single()

    const totalBill = totalBillData?.total_bill_amount || 0

    // Get all energy readings for this device to calculate proportional cost
    const { data: allChannelData } = await supabaseClient
      .from('energy_data')
      .select('channel_number, energy_wh')
      .eq('device_id', device_id)
      .order('timestamp', { ascending: false })
      .limit(deviceAssignment.channel_count)

    // Calculate total device energy consumption
    const deviceEnergyMap = new Map()
    allChannelData?.forEach(reading => {
      if (!deviceEnergyMap.has(reading.channel_number)) {
        deviceEnergyMap.set(reading.channel_number, reading.energy_wh || 0)
      }
    })

    const totalDeviceEnergy = Array.from(deviceEnergyMap.values()).reduce((sum, energy) => sum + energy, 0)
    
    // Calculate proportional cost for this channel
    const channelEnergy = parseFloat(energy_wh) || 0
    const proportionalCost = totalDeviceEnergy > 0 ? (channelEnergy / totalDeviceEnergy) * totalBill : 0

    // Broadcast real-time data instead of storing permanently
    const realtimeData = {
      device_id,
      channel_number: parseInt(channel_number),
      current: parseFloat(current) || 0,
      power: parseFloat(power) || 0,
      energy_wh: channelEnergy,
      cost: proportionalCost,
      timestamp: new Date().toISOString()
    }

    // Send real-time update via Supabase channels
    await supabaseClient.channel(`device_${device_id}`)
      .send({
        type: 'broadcast',
        event: 'energy_update',
        payload: realtimeData
      })

    console.log('Real-time energy data broadcasted for device:', device_id, 'channel:', channel_number)
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Real-time data broadcasted',
        calculated_cost: proportionalCost
      }),
      {
        status: 200,
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
