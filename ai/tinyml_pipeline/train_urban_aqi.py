import os
import pandas as pd
import numpy as np
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Conv1D, Flatten, Dense
from sklearn.preprocessing import MinMaxScaler

# Define paths
DATA_FILE = os.path.join(os.path.dirname(__file__), '..', '..', 'city_day.csv')
MODEL_DIR = os.path.dirname(__file__)

def load_and_preprocess_data():
    df = pd.read_csv(DATA_FILE)
    
    # Select relevant columns and drop NA to have clean data for training
    features = ['PM2.5', 'PM10', 'NOx', 'CO', 'SO2', 'O3']
    target = 'AQI'
    
    df = df[features + [target]].dropna()
    
    X_raw = df[features].values
    y_raw = df[target].values
    
    # Normalize features
    scaler_x = MinMaxScaler()
    X_scaled = scaler_x.fit_transform(X_raw)
    
    # We won't normalize Y so the output is directly AQI, but we scale it down by a factor 
    # to help the neural net learn. Max AQI is ~500.
    y_scaled = y_raw / 500.0
    
    # Create windows of size 5
    window_size = 5
    X_windows = []
    y_windows = []
    
    for i in range(len(X_scaled) - window_size):
        X_windows.append(X_scaled[i:i+window_size])
        y_windows.append(y_scaled[i+window_size])
        
    return np.array(X_windows, dtype=np.float32), np.array(y_windows, dtype=np.float32)

def build_model(window_size, num_features):
    model = Sequential([
        Conv1D(filters=8, kernel_size=3, activation='relu', input_shape=(window_size, num_features)),
        Flatten(),
        Dense(16, activation='relu'),
        Dense(1, activation='linear')
    ])
    model.compile(optimizer='adam', loss='mse', metrics=['mae'])
    return model

def representative_dataset():
    # Provide representative data for TFLite quantization
    X, _ = load_and_preprocess_data()
    for i in range(100):
        yield [np.expand_dims(X[i], axis=0)]

def main():
    print("Loading Urban Dataset...")
    X, y = load_and_preprocess_data()
    
    window_size = X.shape[1]
    num_features = X.shape[2]
    
    print(f"Data shape: X={X.shape}, y={y.shape}")
    
    model = build_model(window_size, num_features)
    
    print("Training Tiny CNN...")
    model.fit(X, y, epochs=10, batch_size=32, validation_split=0.2)
    
    # Convert to TFLite with quantization
    print("Converting to INT8 TFLite...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = representative_dataset
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    
    tflite_model = converter.convert()
    
    tflite_path = os.path.join(MODEL_DIR, 'urban_model.tflite')
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)
        
    print(f"Urban model saved to {tflite_path} ({len(tflite_model)} bytes)")

if __name__ == '__main__':
    main()
