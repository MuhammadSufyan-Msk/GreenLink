#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>
#include <EloquentTinyML.h>
#include "model_data.h"

// --- TinyML Configuration ---
#define NUMBER_OF_INPUTS 25 // 5 time steps * 5 features (temp, hum, soil, precip_proxy, water_proxy)
#define NUMBER_OF_OUTPUTS 1 // flood_event (probability)
#define TENSOR_ARENA_SIZE 8 * 1024 // 8KB arena

Eloquent::TinyML::TfLite<NUMBER_OF_INPUTS, NUMBER_OF_OUTPUTS, TENSOR_ARENA_SIZE> ml;

// --- LoRa Pins (SX1278) ---
#define ss 5
#define rst 14
#define dio0 2

// --- Sensor Pins ---
#define TRIG_PIN 12      // JSN-SR04T Trig
#define ECHO_PIN 13      // JSN-SR04T Echo
#define SOIL_PIN 34      // Analog Soil Moisture

// Node Config
const String NODE_ID = "RURAL-001";
const String NODE_TYPE = "rural";

// BME280 Instance
Adafruit_BME280 bme;

// Timing and Window Buffer
unsigned long lastSendTime = 0;
const int sendInterval = 10000; // 10s
float input_buffer[5][5]; // Window size 5, Features 5
int buffer_index = 0;
bool buffer_full = false;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  Serial.println("GreenLink+ Rural Node with TinyML Initializing...");

  // Init ML Model
  ml.begin(rural_model_tflite);

  // Sensor Pins Setup
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  
  // BME280 Init
  bme.begin(0x76);

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
    for(int j=0; j<5; j++) input_buffer[i][j] = 0.0;
  }
}

float getWaterLevel() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); 
  if (duration == 0) return 0.0;
  
  float distance = duration * 0.034 / 2;
  float tankDepth = 200.0; 
  float level = tankDepth - distance;
  if (level < 0) level = 0;
  if (level > tankDepth) level = tankDepth;
  return level;
}

float getSoilMoisture() {
  int analogValue = analogRead(SOIL_PIN);
  float moisture = map(analogValue, 3500, 1500, 0, 100);
  if (moisture < 0) moisture = 0;
  if (moisture > 100) moisture = 100;
  return moisture;
}

void loop() {
  if (millis() - lastSendTime > sendInterval) {
    
    // 1. Collect Raw Features
    float temp = bme.readTemperature();
    float hum = bme.readHumidity();
    float water_lvl = getWaterLevel(); // Proxy for water_area
    float precip = (water_lvl > 50) ? (water_lvl - 50) * 0.5 : 0; // Fake precipitation logic
    float soil = getSoilMoisture();
    
    // 2. Update Sliding Window
    for (int i = 0; i < 4; i++) {
      for (int j = 0; j < 5; j++) {
        input_buffer[i][j] = input_buffer[i+1][j];
      }
    }
    
    // Normalize (Approximated max values based on context)
    input_buffer[4][0] = temp / 50.0;
    input_buffer[4][1] = hum / 100.0;
    input_buffer[4][2] = soil / 100.0;
    input_buffer[4][3] = precip / 100.0;
    input_buffer[4][4] = water_lvl / 200.0;

    buffer_index++;
    if (buffer_index >= 5) buffer_full = true;
    
    // 3. TinyML Inference
    if (buffer_full) {
      float input_tensor[25];
      int idx = 0;
      for (int i=0; i<5; i++) {
        for (int j=0; j<5; j++) {
          input_tensor[idx++] = input_buffer[i][j];
        }
      }
      
      float output_tensor[1];
      ml.predict(input_tensor, output_tensor);
      
      // Binary prediction threshold
      float flood_prob = output_tensor[0];
      bool flood_event = flood_prob > 0.7; // Strict threshold for false positives
      
      // 4. Send via LoRa
      StaticJsonDocument<256> doc;
      doc["node_id"] = NODE_ID;
      doc["node_type"] = NODE_TYPE;
      doc["water_level"] = water_lvl; 
      doc["soil_moisture"] = soil;
      doc["flood_warning"] = flood_event;
      doc["anomaly"] = flood_event; // General anomaly flag
      doc["battery"] = 85.0; // Mock
      
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
