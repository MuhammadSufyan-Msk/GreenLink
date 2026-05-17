import numpy as np
import pandas as pd
import os

def generate_sensor_data(num_samples=10000, anomaly_ratio=0.05):
    """
    Generate synthetic sensor data with noise and anomalies for training the CNN.
    """
    time = np.arange(num_samples)
    
    # Base signal (sine waves + trend)
    base_signal = np.sin(time * 0.01) * 10 + np.sin(time * 0.05) * 2 + 25
    
    # Add Gaussian noise
    noise = np.random.normal(0, 1.5, num_samples)
    noisy_signal = base_signal + noise
    
    # Add anomalies (spikes)
    anomalies = np.zeros(num_samples)
    labels = np.zeros(num_samples)
    
    num_anomalies = int(num_samples * anomaly_ratio)
    anomaly_indices = np.random.choice(num_samples, num_anomalies, replace=False)
    
    for idx in anomaly_indices:
        anomalies[idx] = np.random.choice([1, -1]) * np.random.uniform(15, 30)
        labels[idx] = 1.0 # Anomaly label
        
    final_signal = noisy_signal + anomalies
    
    df = pd.DataFrame({
        'clean_signal': base_signal,
        'noisy_signal': final_signal,
        'is_anomaly': labels
    })
    
    return df

if __name__ == '__main__':
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)
    
    print("Generating synthetic data...")
    df_train = generate_sensor_data(20000)
    df_test = generate_sensor_data(5000)
    
    df_train.to_csv(os.path.join(data_dir, 'train_data.csv'), index=False)
    df_test.to_csv(os.path.join(data_dir, 'test_data.csv'), index=False)
    
    print(f"Generated train ({len(df_train)} samples) and test ({len(df_test)} samples) data.")
