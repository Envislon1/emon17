import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, Code } from 'lucide-react';
import { toast } from 'sonner';

interface ESP32CodeTemplateProps {
  deviceId: string;
  channelCount?: number;
}

const ESP32CodeTemplate: React.FC<ESP32CodeTemplateProps> = ({ 
  deviceId, 
  channelCount = 8 
}) => {
  const [copied, setCopied] = useState(false);

  const esp32Code = `#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Adafruit_ADS1X15.h>
#include <EEPROM.h>
#include <ArduinoJson.h>

#define LED_PIN 2
#define MAX_CHANNELS 16
#define EEPROM_SIZE 512
#define ENERGY_START_ADDR 0
#define VOLTAGE 220.0
#define EEPROM_WRITE_INTERVAL 5 * 60 * 1000UL  // 5 minutes

// Supabase configuration
const char* supabase_url = "https://lkbetmgdvhklzdfywiwq.supabase.co";
const char* function_url = "https://lkbetmgdvhklzdfywiwq.supabase.co/functions/v1/esp32-energy-upload";
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmV0bWdkdmhrbHpkZnl3aXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMDEwNzgsImV4cCI6MjA2NDU3NzA3OH0.JNTbRMEff0G4eqSSYzjosaQ2-P87lBm0ceSmVENxBvU";

// Global runtime values
int channelCount = ${channelCount};
Adafruit_ADS1115 ads[4]; // Support up to 4 ADS modules (16 channels)
float energyWh[MAX_CHANNELS] = {0};
unsigned long lastEEPROMWrite = 0;
bool device_registered = false;

// WiFiManager custom parameters
char customChannelCount[3] = "${channelCount}";
char customDeviceId[33] = "${deviceId}";
String device_id;

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  EEPROM.begin(EEPROM_SIZE);

  // Setup WiFiManager with custom parameters
  WiFiManager wm;
  WiFiManagerParameter channelParam("channels", "Channel Count (4, 8, 12, 16)", customChannelCount, 3);
  WiFiManagerParameter deviceParam("deviceid", "Device ID", customDeviceId, 32);
  wm.addParameter(&channelParam);
  wm.addParameter(&deviceParam);

  if (!wm.autoConnect("EnergyMonitorESP32")) {
    Serial.println("WiFi connection failed!");
    blinkError();
    ESP.restart();
  }

  // Get values from user input
  channelCount = constrain(atoi(channelParam.getValue()), 4, MAX_CHANNELS);
  channelCount = (channelCount / 4) * 4;  // Round to nearest multiple of 4
  device_id = deviceParam.getValue();

  Serial.printf("Device ID: %s, Channel Count: %d\\n", device_id.c_str(), channelCount);

  loadEnergyFromEEPROM();

  // Initialize ADS1115 modules based on channel count
  uint8_t adsAddresses[4] = {0x48, 0x49, 0x4A, 0x4B};
  int requiredAdsModules = (channelCount + 3) / 4; // Ceiling division
  
  bool adsInitSuccess = true;
  for (int i = 0; i < requiredAdsModules; i++) {
    if (!ads[i].begin(adsAddresses[i])) {
      Serial.printf("ADS1115 #%d (0x%02X) initialization failed!\\n", i, adsAddresses[i]);
      adsInitSuccess = false;
    } else {
      ads[i].setGain(GAIN_ONE);
      Serial.printf("ADS1115 #%d (0x%02X) initialized successfully\\n", i, adsAddresses[i]);
    }
  }

  if (!adsInitSuccess) {
    Serial.println("One or more ADS1115 modules failed to initialize!");
    blinkError();
    while (1);
  }

  // Check if device is registered in the dashboard
  checkDeviceRegistration();
  
  Serial.println("Setup complete!");
}

void loop() {
  if (!device_registered) {
    checkDeviceRegistration();
    delay(10000); // Wait 10 seconds before retrying
    return;
  }

  // Read current from all channels
  float current[MAX_CHANNELS];
  for (int i = 0; i < channelCount; i++) {
    current[i] = readCurrent(i);
  }

  // Calculate power and energy, then upload data for each channel
  for (int i = 0; i < channelCount; i++) {
    float power = VOLTAGE * current[i]; // Power in Watts
    energyWh[i] += power / 3600.0; // Energy in Wh (power per second)
    
    // Send real-time data (cost calculated on server)
    uploadChannelData(i + 1, current[i], power, energyWh[i]); 
    delay(100); // Small delay between uploads
  }

  // Save energy data to EEPROM periodically
  if (millis() - lastEEPROMWrite > EEPROM_WRITE_INTERVAL) {
    saveEnergyToEEPROM();
    lastEEPROMWrite = millis();
  }

  // LED blink to indicate successful operation
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);

  delay(30000); // Upload every 30 seconds
}

float readCurrent(int channel) {
  int adsIndex = channel / 4; // Which ADS1115 module
  int adsChannel = channel % 4; // Which channel on that module
  
  int16_t adc = ads[adsIndex].readADC_SingleEnded(adsChannel);
  float voltage = adc * 0.125 / 1000.0; // Convert to voltage (mV to V)
  float offset = 2.5; // ACS712 zero current voltage
  float current = (voltage - offset) / 0.066; // Convert to current (ACS712-30A sensitivity)
  
  return abs(current); // Return absolute value
}

void uploadChannelData(int channelNumber, float current, float power, float energyWh) {
  HTTPClient http;
  
  http.begin(function_url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  // Create JSON payload (no cost calculation - done on server)
  DynamicJsonDocument doc(256);
  doc["device_id"] = device_id;
  doc["channel_number"] = channelNumber;
  doc["current"] = round(current * 100) / 100.0; // Round to 2 decimal places
  doc["power"] = round(power * 100) / 100.0;
  doc["energy_wh"] = round(energyWh * 100) / 100.0;

  String requestBody;
  serializeJson(doc, requestBody);
  
  int httpCode = http.POST(requestBody);
  Serial.printf("Upload CH%d -> HTTP %d\\n", channelNumber, httpCode);
  
  if (httpCode == 200) {
    // Success - brief LED flash
    digitalWrite(LED_PIN, HIGH);
    delay(50);
    digitalWrite(LED_PIN, LOW);
  } else if (httpCode > 0) {
    Serial.printf("Upload error: %s\\n", http.getString().c_str());
  } else {
    Serial.printf("HTTP error: %d\\n", httpCode);
  }
  
  http.end();
}

void checkDeviceRegistration() {
  HTTPClient http;
  String url = String(supabase_url) + "/rest/v1/device_assignments?select=device_id&device_id=eq." + device_id;
  
  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  int httpCode = http.GET();
  Serial.printf("Device registration check -> HTTP %d\\n", httpCode);
  
  if (httpCode == 200) {
    String payload = http.getString();
    Serial.printf("Response: %s\\n", payload.c_str());
    
    DynamicJsonDocument doc(1024);
    DeserializationError err = deserializeJson(doc, payload);
    
    if (!err && doc.size() > 0) {
      device_registered = true;
      Serial.println("✅ Device is registered in dashboard!");
      
      // Success pattern - 3 quick blinks
      for (int i = 0; i < 3; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(200);
        digitalWrite(LED_PIN, LOW);
        delay(200);
      }
    } else {
      device_registered = false;
      Serial.println("❌ Device not found in dashboard. Please add this device using the dashboard first.");
      Serial.printf("Device ID: %s\\n", device_id.c_str());
      blinkError();
    }
  } else {
    device_registered = false;
    Serial.printf("Registration check failed: HTTP %d\\n", httpCode);
    if (httpCode > 0) {
      Serial.printf("Error response: %s\\n", http.getString().c_str());
    }
    blinkError();
  }
  
  http.end();
}

void saveEnergyToEEPROM() {
  for (int i = 0; i < channelCount; i++) {
    int addr = ENERGY_START_ADDR + i * sizeof(float);
    EEPROM.put(addr, energyWh[i]);
  }
  EEPROM.commit();
  Serial.println("Energy data saved to EEPROM");
}

void loadEnergyFromEEPROM() {
  for (int i = 0; i < channelCount; i++) {
    int addr = ENERGY_START_ADDR + i * sizeof(float);
    EEPROM.get(addr, energyWh[i]);
    
    // Validate loaded data
    if (!isfinite(energyWh[i]) || energyWh[i] < 0 || energyWh[i] > 100000) {
      energyWh[i] = 0.0; // Reset invalid values
    }
  }
  Serial.println("Energy data loaded from EEPROM");
}

void blinkError() {
  // Error pattern - fast blinking
  for (int i = 0; i < 10; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_PIN, LOW);
    delay(100);
  }
}`;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(esp32Code);
      setCopied(true);
      toast.success('Updated ESP32 code copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  return (
    <Card className="energy-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5 text-orange-600" />
            ESP32 {channelCount}-Channel Energy Monitor (Real-time Only)
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyCode}
            className="flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
          <pre>{esp32Code}</pre>
        </div>
        
        <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            ✅ Real-time Only Configuration:
          </p>
          <ul className="text-xs text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
            <li>No permanent data storage - saves database space</li>
            <li>Cost calculation happens on server using total bill amount</li>
            <li>Real-time broadcasts for immediate dashboard updates</li>
            <li>Energy tracking persisted locally on ESP32 EEPROM</li>
            <li>Proportional cost distribution based on energy consumption</li>
          </ul>
        </div>

        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            🔧 How Real-time Mode Works:
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>ESP32 sends current, power, and cumulative energy readings</li>
            <li>Server calculates proportional costs based on total bill setting</li>
            <li>Data broadcasted in real-time to connected dashboard clients</li>
            <li>No database storage - perfect for 500MB limit management</li>
          </ul>
        </div>

        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
            📋 Hardware Requirements remain the same:
          </p>
          <ul className="text-xs text-orange-700 dark:text-orange-300 space-y-1 list-disc list-inside">
            <li>ESP32 development board</li>
            <li>{Math.ceil(channelCount / 4)}x ADS1115 16-bit ADC modules</li>
            <li>{channelCount}x ACS712-30A current sensors</li>
            <li>Energy tracking handled locally on device EEPROM</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ESP32CodeTemplate;
