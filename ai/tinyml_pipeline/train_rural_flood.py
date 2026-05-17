import os
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, Flatten, Dense
from sklearn.preprocessing import MinMaxScaler

DATA_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'pakistan_flood.csv')
MODEL_DIR = os.path.dirname(__file__)

def load_and_preprocess_data():
    df = pd.read_csv(DATA_FILE)
    
    # We will use variables that a rural edge node can measure/estimate
    # JSN-SR04T measures water level (which correlates to water_area_change/precipitation proxies)
    # BME280 measures temperature, humidity
    # Soil sensor measures soil_moisture
    
    # Selecting available numerical features
    features = ['temperature', 'humidity', 'soil_moisture', 'precipitation', 'water_area_km2']
    target = 'flood_event'
    
    # Clean data (replace inf with 0 for this example, dropna)
    df.replace([np.inf, -np.inf], 0, inplace=True)
    df = df[features + [target]].dropna()
    
    X_raw = df[features].values
    y_raw = df[target].values
    
    scaler_x = MinMaxScaler()
    X_scaled = scaler_x.fit_transform(X_raw)
    
    window_size = 5
    X_windows = []
    y_windows = []
    
    for i in range(len(X_scaled) - window_size):
        X_windows.append(X_scaled[i:i+window_size])
        # If there's a flood event in the next window frame, label as 1
        y_windows.append(1.0 if np.sum(y_raw[i:i+window_size]) > 0 else 0.0)
        
    return np.array(X_windows, dtype=np.float32), np.array(y_windows, dtype=np.float32)

def build_model(window_size, num_features):
    model = Sequential([
        Conv1D(filters=8, kernel_size=3, activation='relu', input_shape=(window_size, num_features)),
        Flatten(),
        Dense(8, activation='relu'),
        Dense(1, activation='sigmoid') # Binary classification
    ])
    model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])
    return model

def representative_dataset():
    X, _ = load_and_preprocess_data()
    for i in range(100):
        yield [np.expand_dims(X[i], axis=0)]

def main():
    print("Loading Rural Flood Dataset...")
    X, y = load_and_preprocess_data()
    
    window_size = X.shape[1]
    num_features = X.shape[2]
    
    print(f"Data shape: X={X.shape}, y={y.shape}")
    
    model = build_model(window_size, num_features)
    
    print("Training Tiny CNN...")
    # Add class weights because flood events are usually rare
    count_1 = np.sum(y)
    count_0 = len(y) - count_1
    weight_0 = 1.0
    weight_1 = (count_0 / count_1) if count_1 > 0 else 1.0
    
    model.fit(X, y, epochs=10, batch_size=32, validation_split=0.2, class_weight={0: weight_0, 1: weight_1})
    
    # Convert to TFLite
    print("Converting to INT8 TFLite...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    
    tflite_model = converter.convert()
    
    tflite_path = os.path.join(MODEL_DIR, 'rural_model.tflite')
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
        
    print(f"Rural model saved to {tflite_path} ({len(tflite_model)} bytes)")

if __name__ == '__main__':
    main()
