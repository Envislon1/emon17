
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <Adafruit_ADS1X15.h>
#include <EEPROM.h>
#include <ArduinoJson.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <math.h>
#include <time.h>

#define LED_PIN 2
#define MAX_CHANNELS 16
#define EEPROM_SIZE 512
#define ENERGY_START_ADDR 0
#define FIRMWARE_VERSION_ADDR 400  // Store firmware version at EEPROM address 400
#define VOLTAGE 220.0

const char* supabase_url = "https://lkbetmgdvhklzdfywiwq.supabase.co";
const char* function_url = "https://lkbetmgdvhklzdfywiwq.supabase.co/functions/v1/esp32-energy-upload";
const char* supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrYmV0bWdkdmhrbHpkZnl3aXdxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMDEwNzgsImV4cCI6MjA2NDU3NzA3OH0.JNTbRMEff0G4eqSSYzjosaQ2-P87lBm0ceSmVENxBvU";
const char* ota_check_url = "https://lkbetmgdvhklzdfywiwq.supabase.co/functions/v1/esp32-ota-check";

unsigned long uploadInterval = 2000;        // 2 sec
unsigned long eepromInterval = 300000;       // 5 min
unsigned long resetCheckInterval = 30000;    // 30 sec
unsigned long ledBlinkInterval = 300;
#define OTA_CHECK_INTERVAL 3000    // 3 sec

unsigned long lastUpload = 0;
unsigned long lastEEPROMWrite = 0;
unsigned long lastResetCheck = 0;
unsigned long ledLastToggle = 0;
unsigned long lastOTACheck = 0;

int channelCount = 4;
Adafruit_ADS1115 ads[4];
float energyWh[MAX_CHANNELS] = {0};
float currentValues[MAX_CHANNELS] = {0};

char customChannelCount[3] = "4";
char customDeviceId[33] = "esp32-device";
String device_id;
bool device_registered = false;
String current_firmware_version = "";
bool ledState = false;
bool otaInProgress = false;

// Get current timestamp in seconds since epoch
unsigned long getCurrentTimestamp() {
  return millis() / 1000; // Simple timestamp based on device uptime
}

// Parse semantic version (v1.0.3) or date (20240609) to comparable format
// Returns a comparable integer for version comparison
long parseVersionToComparable(String version) {
  version.trim();
  
  // Handle semantic version format (v1.0.3)
  if (version.startsWith("v") || version.indexOf('.') > 0) {
    // Remove 'v' prefix if present
    if (version.startsWith("v")) {
      version = version.substring(1);
    }
    
    // Parse major.minor.patch
    int firstDot = version.indexOf('.');
    int secondDot = version.lastIndexOf('.');
    
    if (firstDot > 0 && secondDot > firstDot) {
      int major = version.substring(0, firstDot).toInt();
      int minor = version.substring(firstDot + 1, secondDot).toInt();
      int patch = version.substring(secondDot + 1).toInt();
      
      // Combine into single comparable number (assumes max 999 for minor/patch)
      return (long)major * 1000000 + minor * 1000 + patch;
    }
  }
  
  // Handle date format (20240609) or numeric version
  if (version.length() >= 8 && version.toInt() > 0) {
    return version.toInt();
  }
  
  // If version is timestamp-based (millis), treat as-is
  return version.toInt();
}

// Compare two version strings
// Returns: -1 if current < new, 0 if equal, 1 if current > new
int compareVersions(String currentVersion, String newVersion) {
  long currentComparable = parseVersionToComparable(currentVersion);
  long newComparable = parseVersionToComparable(newVersion);
  
  Serial.printf("Version comparison: %s (%ld) vs %s (%ld)\n", 
    currentVersion.c_str(), currentComparable, 
    newVersion.c_str(), newComparable);
  
  if (currentComparable < newComparable) return -1;
  if (currentComparable > newComparable) return 1;
  return 0;
}

// Load firmware version from EEPROM
String loadFirmwareVersion() {
  char version[32];
  for (int i = 0; i < 32; i++) {
    version[i] = EEPROM.read(FIRMWARE_VERSION_ADDR + i);
    if (version[i] == 0) break;
  }
  version[31] = '\0'; // Ensure null termination
  String versionStr = String(version);
  
  // If empty, use initial semantic version
  if (versionStr.length() == 0) {
    versionStr = "v1.0.0"; // Start with semantic version
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
  EEPROM.begin(EEPROM_SIZE);

   // Load current firmware version from EEPROM
  current_firmware_version = loadFirmwareVersion();
  Serial.println("Current firmware version: " + current_firmware_version);

  WiFiManager wm;
  WiFiManagerParameter channelParam("channels", "Channel Count (4,8,12,16)", customChannelCount, 3);
  WiFiManagerParameter deviceParam("deviceid", "Device ID", customDeviceId, 32);
  wm.addParameter(&channelParam);
  wm.addParameter(&deviceParam);

  if (!wm.autoConnect("EnergyTracker")) {
    ESP.restart();
  }

  channelCount = constrain(atoi(channelParam.getValue()), 4, MAX_CHANNELS);
  channelCount = (channelCount / 4) * 4;
  device_id = deviceParam.getValue();

  loadEnergyFromEEPROM();

  uint8_t adsAddresses[4] = {0x48, 0x49, 0x4A, 0x4B};
  int requiredModules = (channelCount + 3) / 4;

  for (int i = 0; i < requiredModules; i++) {
    if (!ads[i].begin(adsAddresses[i])) {
      blinkError(10);
      while (1);
    }
    ads[i].setGain(GAIN_ONE);
  }

  checkDeviceRegistration();

  Serial.println("Setup complete!");
}

void loop() {
  unsigned long now = millis();

  // Check for OTA updates every 3 seconds
  if (millis() - lastOTACheck > OTA_CHECK_INTERVAL) {
    checkForOTAUpdates();
    lastOTACheck = millis();
  }

  if (now - lastResetCheck >= resetCheckInterval) {
    lastResetCheck = now;
    if (device_registered) checkForResetCommand();
  }

  // Read current
  for (int i = 0; i < channelCount; i++) {
    currentValues[i] = readCurrent(i);
    energyWh[i] += (VOLTAGE * currentValues[i]) / 3600.0;
  }

  // Upload data
  if (now - lastUpload >= uploadInterval) {
    lastUpload = now;
    if (device_registered) {
      for (int i = 0; i < channelCount; i++) {
      uploadChannelData(i + 1, currentValues[i], VOLTAGE * currentValues[i], energyWh[i]);
      }
      Serial.println("===== Energy Monitor Data =====");
      for (int i = 0; i < channelCount; i++) {
        float power = VOLTAGE * currentValues[i];
        Serial.printf("Channel %d: Current = %.2f A, Power = %.2f W, Energy = %.2f Wh\n",
                      i + 1, currentValues[i], power, energyWh[i]);
      }
      Serial.println("================================");
    }
  }

  // EEPROM write
  if (now - lastEEPROMWrite >= eepromInterval) {
    lastEEPROMWrite = now;
    saveEnergyToEEPROM();
  }

  // LED Blink
  if (now - ledLastToggle >= ledBlinkInterval) {
    ledLastToggle = now;
    ledState = !ledState;
    digitalWrite(LED_PIN, ledState);
  }
}

float readCurrent(int channel) {
  int adsIndex = channel / 4;
  int adsChannel = channel % 4;
  int16_t adc = ads[adsIndex].readADC_SingleEnded(adsChannel);
  float voltage = adc * 0.125 / 1000.0;
  float offset = 2.5;
  float current = (voltage - offset) / 0.066;
  return abs(current);
}

void uploadChannelData(int ch, float current, float power, float energyWh) {
  HTTPClient http;
  String url = String(supabase_url) + "/functions/v1/esp32-energy-upload";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  DynamicJsonDocument doc(512);
  doc["device_id"] = device_id;
  doc["channel_number"] = ch;
  doc["current"] = round(current * 100) / 100.0;
  doc["power"] = round(power * 100) / 100.0;
  doc["energy_wh"] = round(energyWh * 100) / 100.0;

  String payload;
  serializeJson(doc, payload);
  int httpCode = http.POST(payload);
  Serial.printf("Upload CH%d -> HTTP %d\n", ch, httpCode);
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
    DynamicJsonDocument doc(512);
    if (!deserializeJson(doc, http.getString())) {
      bool reset = doc["reset_command"];
      
      if (reset) {
        Serial.println("..........RESETTING ENERGY...........");
        for (int i = 0; i < MAX_CHANNELS; i++) energyWh[i] = 0.0;
        
        // Clear energy data but preserve firmware version
        for (int i = ENERGY_START_ADDR; i < FIRMWARE_VERSION_ADDR; i++) {
          EEPROM.write(i, 0);
        }
        
        Serial.println("Reset Energy Successfully!");
        Serial.println("....................................");
        EEPROM.commit();
        blinkError(5);
      }
    }
  }
  http.end();
}

void checkDeviceRegistration() {
  HTTPClient http;
  String url = String(supabase_url) + "/functions/v1/check-device-registration?device_id=" + device_id;
  http.begin(url);
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);
  int httpCode = http.GET();

  if (httpCode == 200) {
    DynamicJsonDocument doc(1024);
    if (!deserializeJson(doc, http.getString())) {
      device_registered = doc["registered"];
    }
  } else {
    device_registered = false;
  }
  http.end();
}

void saveEnergyToEEPROM() {
  for (int i = 0; i < channelCount; i++) {
    EEPROM.put(ENERGY_START_ADDR + i * sizeof(float), energyWh[i]);
  }
  EEPROM.commit();
}

void loadEnergyFromEEPROM() {
  for (int i = 0; i < channelCount; i++) {
    EEPROM.get(ENERGY_START_ADDR + i * sizeof(float), energyWh[i]);
    if (!isfinite(energyWh[i]) || energyWh[i] < 0 || energyWh[i] > 100000) {
      energyWh[i] = 0.0;
    }
  }
}

void blinkError(int times) {
  for (int i = 0; i < times * 2; i++) {
    digitalWrite(LED_PIN, i % 2);
    delay(100);
  }
}

// Enhanced OTA Update progress callback with real-time dashboard updates
void updateCallback(size_t progress, size_t total) {
  int percentage = (progress / (total / 100));
  Serial.printf("OTA Download Progress: %d%% (%d/%d bytes)\n", percentage, progress, total);
  
  // Send real-time progress updates to dashboard every 2%
  static int lastReported = -1;
  if ((percentage % 2 == 0) && (percentage != lastReported) && (percentage > 0)) {
    lastReported = percentage;
    
    // Immediately send status update to dashboard
    reportOTAStatus("downloading", percentage, 
      "Downloading firmware: " + String(percentage) + "% (" + 
      String(progress/1024) + "KB/" + String(total/1024) + "KB)");
  }
  
  // Send heartbeat to show device is online during download
  static unsigned long lastHeartbeat = 0;
  unsigned long now = millis();
  if (now - lastHeartbeat > 1000) { // Every 1 second
    lastHeartbeat = now;
    sendDeviceHeartbeat("ota_downloading");
  }
}

// Send device heartbeat to show online status during OTA
void sendDeviceHeartbeat(String activity) {
  HTTPClient http;
  String statusUrl = String(supabase_url) + "/functions/v1/esp32-ota-status";
  
  http.begin(statusUrl);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("apikey", supabase_key);
  http.addHeader("Authorization", String("Bearer ") + supabase_key);

  DynamicJsonDocument heartbeatDoc(256);
  heartbeatDoc["device_id"] = device_id;
  heartbeatDoc["status"] = "heartbeat";
  heartbeatDoc["progress"] = 0;
  heartbeatDoc["message"] = "Device online - " + activity;
  heartbeatDoc["timestamp"] = getCurrentTimestamp();

  String heartbeatBody;
  serializeJson(heartbeatDoc, heartbeatBody);
  
  int httpCode = http.POST(heartbeatBody);
  if (httpCode != 200) {
    Serial.printf("Heartbeat failed: HTTP %d\n", httpCode);
  }
  
  http.end();
}

// Check for OTA updates with enhanced status reporting
void checkForOTAUpdates() {
  // Prevent multiple simultaneous OTA checks
  if (otaInProgress) {
    Serial.println("⏳ OTA operation in progress, skipping check");
    return;
  }
  
  Serial.println("🔍 Checking for firmware updates...");
  Serial.println("Current firmware version: " + current_firmware_version);
  
  // Send initial check status
  reportOTAStatus("checking", 0, "Checking for firmware updates...");
  
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
  
  // Declare responseDoc at function scope
  DynamicJsonDocument responseDoc(1024);
  bool hasUpdate = false;
  
  if (httpCode == 200) {
    String payload = http.getString();
    Serial.println("OTA Check Response: " + payload);
    
    if (!deserializeJson(responseDoc, payload)) {
      hasUpdate = responseDoc["has_update"];
      
      if (hasUpdate) {
        String firmwareUrl = responseDoc["firmware_url"];
        String filename = responseDoc["filename"];
        String firmwareVersion = responseDoc["firmware_version"];
        int fileSize = responseDoc["file_size"];
        
        // Enhanced version comparison using semantic versioning
        int versionComparison = compareVersions(current_firmware_version, firmwareVersion);
        
        if (versionComparison >= 0) {
          Serial.println("⚠️ Server reports update available but version comparison shows current >= new");
          Serial.printf("Current: %s, Available: %s\n", current_firmware_version.c_str(), firmwareVersion.c_str());
          
          // Report that no update is needed
          reportOTAStatus("no_update", 100, "Current version is up to date or newer");
          return;
        }
        
        Serial.println("🚀 FIRMWARE UPDATE AVAILABLE!");
        Serial.println("URL: " + firmwareUrl);
        Serial.println("File: " + filename + " (" + String(fileSize) + " bytes)");
        Serial.println("New Version: " + firmwareVersion);
        Serial.println("Current Version: " + current_firmware_version);
        
        // Set OTA in progress flag
        otaInProgress = true;
        
        // Report update start with detailed information
        reportOTAStatus("preparing", 0, 
          "Firmware update starting: " + filename + " (v" + firmwareVersion + ", " + 
          String(fileSize/1024) + "KB)");
        
        delay(1000); // Give dashboard time to update
        
        // Perform the update
        performOTAUpdate(firmwareUrl, filename, firmwareVersion, fileSize);
      } else {
        String message = responseDoc["message"];
        Serial.println("✅ " + message);
        
        // Report no update available
        reportOTAStatus("up_to_date", 100, "No firmware updates available");
        
        // Check if we have version info
        if (responseDoc.containsKey("current_version") && responseDoc.containsKey("latest_version")) {
          String currentVer = responseDoc["current_version"];
          String latestVer = responseDoc["latest_version"];
          Serial.println("Current: " + currentVer + ", Latest: " + latestVer);
        }
      }
    } else {
      Serial.println("❌ Failed to parse OTA response");
      reportOTAStatus("error", 0, "Failed to parse server response");
    }
  } else if (httpCode != 404) {
    Serial.printf("❌ OTA check failed: HTTP %d\n", httpCode);
    reportOTAStatus("error", 0, "Failed to check for updates (HTTP " + String(httpCode) + ")");
    if (httpCode > 0) {
      Serial.println("Error: " + http.getString());
    }
  } else {
    // HTTP 404 means no updates available - this is normal
    reportOTAStatus("up_to_date", 100, "No updates available");
  }
  
  http.end();
  
  // Reset the OTA flag only if no update was triggered
  if (httpCode != 200 || !hasUpdate) {
    otaInProgress = false;
  }
}

// Enhanced OTA update with detailed progress reporting
void performOTAUpdate(String firmwareUrl, String filename, String newVersion, int fileSize) {
  Serial.println("📥 Starting OTA download from: " + firmwareUrl);
  Serial.println("Updating from version " + current_firmware_version + " to " + newVersion);
  
  // Report download start with file information
  reportOTAStatus("downloading", 0, 
    "Starting download: " + filename + " (" + String(fileSize/1024) + "KB)");
  
  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate verification for simplicity
  client.setTimeout(120); // 2 minute timeout
  
  // Configure HTTP update with progress callback
  httpUpdate.onProgress(updateCallback);
  
  Serial.println("💾 Free heap before update: " + String(ESP.getFreeHeap()));
  
  // Report that download is beginning
  reportOTAStatus("downloading", 1, "Connecting to download server...");
  delay(500);
  
  // Perform the update
  t_httpUpdate_return ret = httpUpdate.update(client, firmwareUrl);
  
  switch (ret) {
    case HTTP_UPDATE_FAILED:
      {
        String error = "Update failed (" + String(httpUpdate.getLastError()) + "): " + httpUpdate.getLastErrorString();
        Serial.println("❌ " + error);
        reportOTAStatus("failed", 0, error);
        otaInProgress = false; // Reset flag on failure
      }
      break;
      
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("ℹ️ No updates found (should not happen)");
      reportOTAStatus("no_update", 100, "No updates available");
      otaInProgress = false; // Reset flag
      break;
      
    case HTTP_UPDATE_OK:
      Serial.println("✅ DOWNLOAD SUCCESSFUL! Installing firmware...");
      
      // Report that download completed and installation is starting
      reportOTAStatus("installing", 90, "Download complete! Installing firmware...");
      delay(1000);
      
      // CRITICAL: Save the new firmware version IMMEDIATELY before restart
      Serial.println("Saving new firmware version: " + newVersion);
      saveFirmwareVersion(newVersion);
      
      // Force EEPROM write and verification
      delay(500);
      String verifyVersion = loadFirmwareVersion();
      Serial.println("Verified saved version: " + verifyVersion);
      
      if (verifyVersion == newVersion) {
        Serial.println("✅ Version verification successful!");
        reportOTAStatus("installing", 95, "Version saved, preparing to restart...");
      } else {
        Serial.println("❌ Version verification failed! Expected: " + newVersion + ", Got: " + verifyVersion);
        reportOTAStatus("installing", 95, "Warning: Version verification failed");
      }
      
      delay(1000);
      reportOTAStatus("complete", 100, "Update completed successfully! Device restarting...");
      delay(2000); // Give time for final status report
      
      // Device will restart automatically after this
      break;
  }
}

// Enhanced OTA status reporting with better error handling
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
  statusDoc["firmware_version"] = current_firmware_version;

  String statusBody;
  serializeJson(statusDoc, statusBody);
  
  int httpCode = http.POST(statusBody);
  if (httpCode == 200) {
    Serial.printf("📊 OTA Status sent: %s (%d%%) ✅\n", status.c_str(), progress);
  } else {
    Serial.printf("📊 OTA Status failed: %s (%d%%) -> HTTP %d ❌\n", status.c_str(), progress, httpCode);
    if (httpCode > 0) {
      Serial.println("Error response: " + http.getString());
    }
  }
  
  http.end();
}
