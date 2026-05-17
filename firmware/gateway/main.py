import time
import json
import sqlite3
import paho.mqtt.client as mqtt
from datetime import datetime

# In a real scenario, we'd use a LoRa library like pyLoRa or adafruit-circuitpython-rfm9x
# import busio
# from digitalio import DigitalInOut, Direction, Pull
# import adafruit_rfm9x

class GreenLinkGateway:
    def __init__(self):
        self.mqtt_broker = "localhost"
        self.mqtt_port = 1883
        self.mqtt_topic_prefix = "greenlink"
        
        self.client = mqtt.Client(client_id="greenlink_gateway_01")
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        
        self.connected = False
        self.db = self.setup_db()
        
        # Setup LoRa (mocked for now)
        self.setup_lora()
        
    def setup_db(self):
        conn = sqlite3.connect('gateway_buffer.db')
        c = conn.cursor()
        c.execute('''CREATE TABLE IF NOT EXISTS buffer 
                     (id INTEGER PRIMARY KEY AUTOINCREMENT, 
                      topic TEXT, 
                      payload TEXT, 
                      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)''')
        conn.commit()
        return conn
        
    def setup_lora(self):
        print("[LoRa] Initializing SX1278 transceiver...")
        # Mock initialization
        print("[LoRa] Listening on 433MHz")
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("[MQTT] Connected to broker")
            self.connected = True
            self.flush_buffer()
        else:
            print(f"[MQTT] Connection failed with code {rc}")
            
    def on_disconnect(self, client, userdata, rc):
        print("[MQTT] Disconnected from broker")
        self.connected = False
        
    def start(self):
        try:
            self.client.connect(self.mqtt_broker, self.mqtt_port, 60)
            self.client.loop_start()
        except Exception as e:
            print(f"[MQTT] Failed to connect: {e}")
            
        print("[Gateway] Running... waiting for LoRa packets")
        try:
            while True:
                # Mock receiving a packet from LoRa
                packet = self.receive_lora_packet()
                if packet:
                    self.process_packet(packet)
                time.sleep(2) # Mock interval
        except KeyboardInterrupt:
            print("[Gateway] Shutting down")
            self.client.loop_stop()
            self.client.disconnect()
            
    def receive_lora_packet(self):
        # In reality, this reads from SPI LoRa module
        return None # Silent unless testing
        
    def process_packet(self, packet):
        try:
            data = json.loads(packet)
            node_id = data.get("node_id", "UNKNOWN")
            
            # Send to edge AI filter if configured (skipped for now, assuming backend AI)
            
            topic = f"{self.mqtt_topic_prefix}/{node_id}/data"
            payload = json.dumps(data)
            
            if self.connected:
                self.client.publish(topic, payload, qos=1)
                print(f"[MQTT] Published data from {node_id}")
            else:
                self.buffer_data(topic, payload)
        except json.JSONDecodeError:
            print("[Gateway] Received invalid JSON packet")
            
    def buffer_data(self, topic, payload):
        c = self.db.cursor()
        c.execute("INSERT INTO buffer (topic, payload) VALUES (?, ?)", (topic, payload))
        self.db.commit()
        print(f"[Gateway] Buffered packet for {topic} (offline)")
        
    def flush_buffer(self):
        c = self.db.cursor()
        c.execute("SELECT id, topic, payload FROM buffer ORDER BY timestamp ASC")
        rows = c.fetchall()
        
        if rows:
            print(f"[Gateway] Flushing {len(rows)} buffered packets to MQTT...")
            for row in rows:
                self.client.publish(row[1], row[2], qos=1)
                c.execute("DELETE FROM buffer WHERE id=?", (row[0],))
            self.db.commit()
            print("[Gateway] Buffer flushed")

if __name__ == "__main__":
    gateway = GreenLinkGateway()
    gateway.start()
