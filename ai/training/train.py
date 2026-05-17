import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import numpy as np
import os
import sys

# Add parent dir to path to import model
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from model.cnn_1d import CNN1DFilter

def train_model():
    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    save_dir = os.path.join(os.path.dirname(__file__), '..', 'saved_models')
    os.makedirs(save_dir, exist_ok=True)
    
    # Check if data exists
    train_file = os.path.join(data_dir, 'train_data.csv')
    if not os.path.exists(train_file):
        print("Training data not found. Please run generate_synthetic.py first.")
        return
        
    df = pd.read_csv(train_file)
    
    # Prepare data for PyTorch CNN (Batch, Channels, Sequence)
    # We'll use a sliding window of size 32
    seq_length = 32
    
    noisy_seqs = []
    clean_seqs = []
    anomaly_labels = []
    
    noisy_data = df['noisy_signal'].values
    clean_data = df['clean_signal'].values
    anomaly_data = df['is_anomaly'].values
    
    for i in range(len(noisy_data) - seq_length):
        noisy_seqs.append(noisy_data[i:i+seq_length])
        clean_seqs.append(clean_data[i:i+seq_length])
        # If any point in sequence is anomaly, label sequence as anomaly
        anomaly_labels.append(1.0 if np.sum(anomaly_data[i:i+seq_length]) > 0 else 0.0)
        
    X = torch.tensor(np.array(noisy_seqs), dtype=torch.float32).unsqueeze(1) # (N, 1, seq_length)
    Y_clean = torch.tensor(np.array(clean_seqs), dtype=torch.float32).unsqueeze(1) # (N, 1, seq_length)
    Y_anomaly = torch.tensor(np.array(anomaly_labels), dtype=torch.float32).unsqueeze(1) # (N, 1)
    
    # Model, Loss, Optimizer
    model = CNN1DFilter(in_channels=1, out_channels=1)
    criterion_mse = nn.MSELoss()
    criterion_bce = nn.BCELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.001)
    
    batch_size = 64
    num_epochs = 10
    num_batches = len(X) // batch_size
    
    print("Starting training...")
    for epoch in range(num_epochs):
        epoch_loss = 0.0
        for i in range(num_batches):
            start_idx = i * batch_size
            end_idx = start_idx + batch_size
            
            batch_x = X[start_idx:end_idx]
            batch_y_clean = Y_clean[start_idx:end_idx]
            batch_y_anomaly = Y_anomaly[start_idx:end_idx]
            
            optimizer.zero_grad()
            
            out_clean, out_anomaly = model(batch_x)
            
            # Combined loss: Reconstruction MSE + Anomaly BCE
            loss_mse = criterion_mse(out_clean, batch_y_clean)
            loss_bce = criterion_bce(out_anomaly, batch_y_anomaly)
            loss = loss_mse + loss_bce * 0.5
            
            loss.backward()
            optimizer.step()
            
            epoch_loss += loss.item()
            
        print(f"Epoch {epoch+1}/{num_epochs}, Loss: {epoch_loss/num_batches:.4f}")
        
    # Save model
    torch.save(model.state_dict(), os.path.join(save_dir, 'cnn_filter.pth'))
    print(f"Model saved to {os.path.join(save_dir, 'cnn_filter.pth')}")

if __name__ == '__main__':
    train_model()
