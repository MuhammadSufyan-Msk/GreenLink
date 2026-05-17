#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <BH1750.h>
#include <PMSerial.h>
#include <EloquentTinyML.h>
#include "model_data.h"

// --- TinyML Configuration ---
#define NUMBER_OF_INPUTS 30 // 5 time steps * 6 features (PM2.5, PM10, NOx, CO, SO2, O3)
#define NUMBER_OF_OUTPUTS 1 // AQI
#define TENSOR_ARENA_SIZE 8 * 1024 // 8KB arena for tiny 1D CNN

Eloquent::TinyML::TfLite<NUMBER_OF_INPUTS, NUMBER_OF_OUTPUTS, TENSOR_ARENA_SIZE> ml;

// --- LoRa Pins (SX1278) ---
#define ss 5
#define rst 14
#define dio0 2

// --- Sensor Pins ---
#define MQ135_PIN 34     // Analog MQ-135

// Node Config
const String NODE_ID = "URBAN-001";
const String NODE_TYPE = "urban";

// Sensor Instances
Adafruit_BME280 bme;
BH1750 lightMeter;
SerialPM pms(PMSx003, 16, 17); // PMS5003

// Timing and Window Buffer
unsigned long lastSendTime = 0;
const int sendInterval = 10000; // 10s
float input_buffer[5][6]; // Window size 5, Features 6
int buffer_index = 0;
bool buffer_full = false;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("GreenLink+ Urban Node with TinyML Initializing...");

  // Init ML Model
  ml.begin(urban_model_tflite);

  // I2C Sensors
  Wire.begin();
  bme.begin(0x76);
  lightMeter.begin();

  // UART Sensor
  pms.init();

  // LoRa Init
  LoRa.setPins(ss, rst, dio0);
  if (!LoRa.begin(433E6)) {
    Serial.println("Starting LoRa failed!");
    while (1);
  }
  LoRa.setSpreadingFactor(12);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(8);
  LoRa.setTxPower(20);
  
  // Initialize Buffer
  for(int i=0; i<5; i++) {
    for(int j=0; j<6; j++) input_buffer[i][j] = 0.0;
  }
}

float getGasProxy(int pin, float min_val, float max_val) {
  int raw = analogRead(pin);
  return min_val + ((float)raw / 4095.0) * (max_val - min_val);
}

void loop() {
  if (millis() - lastSendTime > sendInterval) {
    pms.read();
    
    // 1. Collect Raw Features
    // PM2.5, PM10 from PMS5003
    float pm25 = pms.pm25;
    float pm10 = pms.pm10;
    
    // We map MQ-135 to approximate gas values for NOx, CO, SO2, O3
    float nox = getGasProxy(MQ135_PIN, 0.0, 50.0);
    float co = getGasProxy(MQ135_PIN, 0.0, 5.0);
    float so2 = getGasProxy(MQ135_PIN, 0.0, 20.0);
    float o3 = getGasProxy(MQ135_PIN, 0.0, 100.0);
    
    // 2. Update Sliding Window
    // Shift old values
    for (int i = 0; i < 4; i++) {
      for (int j = 0; j < 6; j++) {
        input_buffer[i][j] = input_buffer[i+1][j];
      }
    }
    
    // Normalize and add new values (assuming Max Scaler used in Python)
    input_buffer[4][0] = pm25 / 500.0;
    input_buffer[4][1] = pm10 / 500.0;
    input_buffer[4][2] = nox / 100.0;
    input_buffer[4][3] = co / 10.0;
    input_buffer[4][4] = so2 / 50.0;
    input_buffer[4][5] = o3 / 150.0;

    buffer_index++;
    if (buffer_index >= 5) buffer_full = true;
    
    // 3. TinyML Inference
    if (buffer_full) {
      // Flatten buffer to 1D array
      float input_tensor[30];
      int idx = 0;
      for (int i=0; i<5; i++) {
        for (int j=0; j<6; j++) {
          input_tensor[idx++] = input_buffer[i][j];
        }
      }
      
      float output_tensor[1];
      ml.predict(input_tensor, output_tensor);
      
      // Denormalize output (we scaled by 500 in python)
      float predicted_aqi = output_tensor[0] * 500.0;
      
      // Anomaly Logic
      bool is_anomaly = predicted_aqi > 150.0; 
      
      // 4. Send via LoRa
      StaticJsonDocument<256> doc;
      doc["node_id"] = NODE_ID;
      doc["node_type"] = NODE_TYPE;
      doc["air_quality"] = predicted_aqi;
      doc["anomaly"] = is_anomaly;
      doc["battery"] = 92.0; // Mock
      
      String payload;
      serializeJson(doc, payload);
      Serial.println("LoRa Transmit: " + payload);
      
      LoRa.beginPacket();
      LoRa.print(payload);
      LoRa.endPacket();
    } else {
      Serial.println("Buffering window...");
    }
    
    lastSendTime = millis();
  }
}
