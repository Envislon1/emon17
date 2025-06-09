
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
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <time.h>

#define LED_PIN 2
#define MAX_CHANNELS 16
#define EEPROM_SIZE 512
#define ENERGY_START_ADDR 0
#define FIRMWARE_VERSION_ADDR 400  // Store firmware version at EEPROM address 400
#define VOLTAGE 220.0
#define EEPROM_WRITE_INTERVAL 5 * 60 * 1000UL  // 5 minutes
#define RESET_CHECK_INTERVAL 30 * 1000UL       // 30 seconds
#define OTA_CHECK_INTERVAL 3 * 60 * 1000UL     // 3 minutes

// Supabase configuration
const char* supabase_url = "https://lkbetmgdvhklzdfywiwq.supabase.co";
const char* function_url = "https://lkbetmgdvhklzdfywiwq.supabase.co/functions/v1/esp32-energy-upload";
const char* ota_check_url = "https://lkbetmgdvhklzdfywiwq.supabase.co/functions/v1/esp32-ota-check";
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmV0bWdkdmhrbHpkZnl3aXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMDEwNzgsImV4cCI6MjA2NDU3NzA3OH0.JNTbRMEff0G4eqSSYzjosaQ2-P87lBm0ceSmVENxBvU";

// Global runtime values
int channelCount = ${channelCount};
Adafruit_ADS1115 ads[4]; // Support up to 4 ADS modules (16 channels)
float energyWh[MAX_CHANNELS] = {0};
unsigned long lastEEPROMWrite = 0;
unsigned long lastResetCheck = 0;
unsigned long lastOTACheck = 0;
bool device_registered = false;
String current_firmware_version = "";

// WiFiManager custom parameters
char customChannelCount[3] = "${channelCount}";
char customDeviceId[33] = "${deviceId}";
String device_id;

// Get current timestamp in seconds since epoch
unsigned long getCurrentTimestamp() {
  return millis() / 1000; // Simple timestamp based on device uptime
}

// Load firmware version from EEPROM
String loadFirmwareVersion() {
  char version[32];
  for (int i = 0; i < 32; i++) {
    version[i] = EEPROM.read(FIRMWARE_VERSION_ADDR + i);
    if (version[i] == 0) break;
  }
  version[31] = '\\0'; // Ensure null termination
  String versionStr = String(version);
  
  // If empty or "initial", generate a timestamp-based version
  if (versionStr.length() == 0 || versionStr == "initial") {
    versionStr = String(millis()); // Use millis as initial version
    saveFirmwareVersion(versionStr);
  }
  
  return versionStr;
}

// Save firmware version to EEPROM
void saveFirmwareVersion(String version) {
  // Clear the version area first
  for (int i = 0; i < 32; i++) {
    EEPROM.write(FIRMWARE_VERSION_ADDR + i, 0);
  }
  
  // Write new version - fix type mismatch by casting to int
  for (int i = 0; i < (int)version.length() && i < 31; i++) {
    EEPROM.write(FIRMWARE_VERSION_ADDR + i, version[i]);
  }
  EEPROM.commit();
  Serial.println("Firmware version saved to EEPROM: " + version);
  
  // Update current version in memory
  current_firmware_version = version;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  EEPROM.begin(EEPROM_SIZE);

  // Load current firmware version from EEPROM
  current_firmware_version = loadFirmwareVersion();
  Serial.println("Current firmware version: " + current_firmware_version);

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
  
  // Check for OTA updates on startup
  checkForOTAUpdates();
  
  Serial.println("Setup complete!");
}

void loop() {
  if (!device_registered) {
    checkDeviceRegistration();
    delay(10000); // Wait 10 seconds before retrying
    return;
  }

  // Check for reset commands periodically
  if (millis() - lastResetCheck > RESET_CHECK_INTERVAL) {
    checkForResetCommand();
    lastResetCheck = millis();
  }

  // Check for OTA updates periodically
  if (millis() - lastOTACheck > OTA_CHECK_INTERVAL) {
    checkForOTAUpdates();
    lastOTACheck = millis();
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
    
    Serial.printf("[CH%d] Current: %.2f A, Power: %.2f W, Energy: %.2f Wh\\n", 
      i + 1, current[i], power, energyWh[i]);
    
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

// OTA Update progress callback
void updateCallback(size_t progress, size_t total) {
  int percentage = (progress / (total / 100));
  Serial.printf("OTA Update: %d%% (%d/%d bytes)\\n", percentage, progress, total);
  
  // Report progress to server
  static int lastReported = 0;
  if ((percentage % 10 == 0) && (percentage != lastReported)) {
    lastReported = percentage;
    reportOTAStatus("downloading", percentage, "Downloading firmware: " + String(percentage) + "%");
  }
}

// Check for OTA updates from Supabase
void checkForOTAUpdates() {
  Serial.println("🔍 Checking for firmware updates...");
  Serial.println("Current firmware version: " + current_firmware_version);
  
  HTTPClient http;
  http.begin(ota_check_url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  // Create request payload with current firmware version
  DynamicJsonDocument requestDoc(512);
  requestDoc["device_id"] = device_id;
  requestDoc["current_firmware_version"] = current_firmware_version;
  String requestBody;
  serializeJson(requestDoc, requestBody);

  int httpCode = http.POST(requestBody);
  
  if (httpCode == 200) {
    String payload = http.getString();
    Serial.println("OTA Check Response: " + payload);
    
    DynamicJsonDocument responseDoc(1024);
    if (!deserializeJson(responseDoc, payload)) {
      bool hasUpdate = responseDoc["has_update"];
      
      if (hasUpdate) {
        String firmwareUrl = responseDoc["firmware_url"];
        String filename = responseDoc["filename"];
        String firmwareVersion = responseDoc["firmware_version"];
        int fileSize = responseDoc["file_size"];
        
        Serial.println("🚀 FIRMWARE UPDATE AVAILABLE!");
        Serial.println("URL: " + firmwareUrl);
        Serial.println("File: " + filename + " (" + String(fileSize) + " bytes)");
        Serial.println("New Version: " + firmwareVersion);
        Serial.println("Current Version: " + current_firmware_version);
        
        // Report update start
        reportOTAStatus("starting", 0, "Starting firmware update: " + filename);
        
        // Perform the update
        performOTAUpdate(firmwareUrl, filename, firmwareVersion);
      } else {
        String message = responseDoc["message"];
        Serial.println("✅ " + message);
        
        // Check if we have version info
        if (responseDoc.containsKey("current_version") && responseDoc.containsKey("latest_version")) {
          String currentVer = responseDoc["current_version"];
          String latestVer = responseDoc["latest_version"];
          Serial.println("Current: " + currentVer + ", Latest: " + latestVer);
        }
      }
    } else {
      Serial.println("❌ Failed to parse OTA response");
    }
  } else if (httpCode != 404) {
    Serial.printf("❌ OTA check failed: HTTP %d\\n", httpCode);
    if (httpCode > 0) {
      Serial.println("Error: " + http.getString());
    }
  }
  
  http.end();
}

// Perform the actual OTA update
void performOTAUpdate(String firmwareUrl, String filename, String newVersion) {
  Serial.println("📥 Starting OTA download from: " + firmwareUrl);
  Serial.println("Updating from version " + current_firmware_version + " to " + newVersion);
  
  // Report download start
  reportOTAStatus("downloading", 0, "Downloading firmware from cloud storage");
  
  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate verification for simplicity
  client.setTimeout(120); // 2 minute timeout
  
  // Configure HTTP update with progress callback
  httpUpdate.onProgress(updateCallback);
  
  Serial.println("💾 Free heap before update: " + String(ESP.getFreeHeap()));
  
  // Perform the update
  t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);
  
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      {
        String error = "Update failed (" + String(httpUpdate.getLastError()) + "): " + httpUpdate.getLastErrorString();
        Serial.println("❌ " + error);
        reportOTAStatus("failed", 0, error);
      }
      break;
      
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("ℹ️ No updates found (should not happen)");
      reportOTAStatus("no_update", 100, "No updates available");
      break;
      
    case HTTP_UPDATE_OK:
      Serial.println("✅ UPDATE SUCCESSFUL!");
      
      // CRITICAL: Save the new firmware version IMMEDIATELY before restart
      Serial.println("Saving new firmware version: " + newVersion);
      saveFirmwareVersion(newVersion);
      
      // Verify the version was saved
      String verifyVersion = loadFirmwareVersion();
      Serial.println("Verified saved version: " + verifyVersion);
      
      reportOTAStatus("complete", 100, "Update completed successfully, restarting device");
      delay(2000); // Give time for status report and EEPROM write
      
      // Device will restart automatically after this
      break;
  }
}

// Report OTA status back to Supabase
void reportOTAStatus(String status, int progress, String message) {
  HTTPClient http;
  String statusUrl = String(supabase_url) + "/functions/v1/esp32-ota-status";
  
  http.begin(statusUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  DynamicJsonDocument statusDoc(512);
  statusDoc["device_id"] = device_id;
  statusDoc["status"] = status;
  statusDoc["progress"] = progress;
  statusDoc["message"] = message;
  statusDoc["timestamp"] = getCurrentTimestamp();

  String statusBody;
  serializeJson(statusDoc, statusBody);
  
  int httpCode = http.POST(statusBody);
  Serial.printf("📊 OTA Status reported: %s (%d%%) -> HTTP %d\\n", status.c_str(), progress, httpCode);
  
  http.end();
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

void checkForResetCommand() {
  HTTPClient http;
  String url = String(supabase_url) + "/functions/v1/energy-reset-command/check-reset?device_id=" + device_id;

  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(512);
    
    if (!deserializeJson(doc, payload)) {
      bool resetCommand = doc["reset_command"];
      
      if (resetCommand) {
        Serial.println("🔄 ENERGY RESET COMMAND RECEIVED!");
        
        // Reset all energy counters
        for (int i = 0; i < MAX_CHANNELS; i++) {
          energyWh[i] = 0.0;
        }
        
        // Clear EEPROM energy data only (preserve firmware version)
        for (int i = ENERGY_START_ADDR; i < FIRMWARE_VERSION_ADDR; i++) {
          EEPROM.write(i, 0);
        }
        EEPROM.commit();
        
        Serial.println("✅ Energy counters have been reset!");
        Serial.println("✅ EEPROM energy data cleared!");
        
        // Blink LED to indicate successful reset
        for (int i = 0; i < 5; i++) {
          digitalWrite(LED_PIN, HIGH);
          delay(200);
          digitalWrite(LED_PIN, LOW);
          delay(200);
        }
        
        // Send confirmation message if available
        String message = doc["message"];
        if (message.length() > 0) {
          Serial.println("Dashboard message: " + message);
        }
      }
    }
  } else if (httpCode != 404) {
    Serial.printf("Reset check failed: HTTP %d\\n", httpCode);
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
      toast.success('Fixed ESP32 code copied to clipboard!');
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
            Fixed ESP32 Code - Compilation Error Resolved
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={copyCode}
            className="flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy Fixed Code'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
          <pre>{esp32Code}</pre>
        </div>
        
        <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
            🔧 Fixed Compilation Error:
          </p>
          <ul className="text-xs text-red-700 dark:text-red-300 space-y-1 list-disc list-inside">
            <li>Changed `min(version.length(), 31)` to `(int)version.length() && i < 31`</li>
            <li>Resolved type mismatch between unsigned int and int</li>
            <li>Added explicit type casting to fix template deduction</li>
            <li>Maintained the same functionality with proper bounds checking</li>
          </ul>
        </div>

        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
            ✅ What Was Fixed:
          </p>
          <ul className="text-xs text-green-700 dark:text-green-300 space-y-1 list-disc list-inside">
            <li>The ESP32 compiler couldn't resolve the min() template with mixed types</li>
            <li>Cast version.length() to int to match the literal 31</li>
            <li>Used logical AND (&&) for proper bounds checking</li>
            <li>Code now compiles successfully on ESP32 Arduino framework</li>
          </ul>
        </div>

        <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
            📋 Next Steps:
          </p>
          <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Copy this fixed code to your Arduino IDE</li>
            <li>The compilation error should now be resolved</li>
            <li>Upload to your ESP32 device</li>
            <li>The OTA update loop issue should also be fixed</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ESP32CodeTemplate;
