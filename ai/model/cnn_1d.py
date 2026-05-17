import torch
import torch.nn as nn
import torch.nn.functional as F

class CNN1DFilter(nn.Module):
    """
    1D Convolutional Neural Network for filtering noisy sensor data 
    and detecting anomalies.
    """
    def __init__(self, in_channels=1, out_channels=1, kernel_size=3):
        super(CNN1DFilter, self).__init__()
        
        # 1D Convolutional layers
        self.conv1 = nn.Conv1d(in_channels=in_channels, out_channels=16, kernel_size=kernel_size, padding=kernel_size//2)
        self.conv2 = nn.Conv1d(in_channels=16, out_channels=32, kernel_size=kernel_size, padding=kernel_size//2)
        
        # Output layer for smoothing
        self.conv_out = nn.Conv1d(in_channels=32, out_channels=out_channels, kernel_size=kernel_size, padding=kernel_size//2)
        
        # Anomaly detection branch (Classification)
        self.fc_anomaly = nn.Linear(32, 1)

    def forward(self, x):
        # x shape: (batch_size, channels, seq_length)
        
        # Feature extraction
        h1 = F.relu(self.conv1(x))
        h2 = F.relu(self.conv2(h1))
        
        # Filtering (Regression to clean signal)
        filtered = self.conv_out(h2)
        
        # Anomaly Detection (using pooled features)
        # Global average pooling
        pooled = torch.mean(h2, dim=2) 
        anomaly_score = torch.sigmoid(self.fc_anomaly(pooled))
        
        return filtered, anomaly_score
