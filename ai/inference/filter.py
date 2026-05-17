import os
import torch
import numpy as np
from model.cnn_1d import CNN1DFilter

class FilterEngine:
    def __init__(self):
        self.model = CNN1DFilter(in_channels=1, out_channels=1)
        
        # Load weights if available, otherwise use initialized weights
        model_path = os.path.join(os.path.dirname(__file__), '..', 'saved_models', 'cnn_filter.pth')
        if os.path.exists(model_path):
            self.model.load_state_dict(torch.load(model_path))
            print(f"Loaded CNN model from {model_path}")
        else:
            print("Warning: Model weights not found. Using untrained model.")
            
        self.model.eval()
        
        # History buffers for each node to maintain sequences
        self.history = {}
        self.seq_length = 32

    def process_data(self, node_id, sensor_data):
        """
        Process incoming dictionary of sensor data, filter numerical values,
        and detect anomalies.
        """
        if node_id not in self.history:
            self.history[node_id] = {}
            
        filtered_data = sensor_data.copy()
        is_anomaly = False
        
        with torch.no_grad():
            for key, val in sensor_data.items():
                # Only process numeric sensor values
                if isinstance(val, (int, float)) and key not in ['filtered', 'anomaly']:
                    if key not in self.history[node_id]:
                        self.history[node_id][key] = [val] * self.seq_length
                        
                    # Update history
                    self.history[node_id][key].pop(0)
                    self.history[node_id][key].append(val)
                    
                    # Prepare tensor
                    seq = np.array(self.history[node_id][key], dtype=np.float32)
                    x = torch.tensor(seq).unsqueeze(0).unsqueeze(0) # (1, 1, seq_length)
                    
                    # Inference
                    out_clean, out_anomaly = self.model(x)
                    
                    # Extract last value from filtered sequence as the current filtered value
                    filtered_val = out_clean[0, 0, -1].item()
                    anomaly_score = out_anomaly[0, 0].item()
                    
                    # If this sensor is an anomaly, flag the whole reading
                    if anomaly_score > 0.6:
                        is_anomaly = True
                        
                    # Smooth the output a bit (moving average with original to avoid drift on untrained model)
                    filtered_data[key] = round(val * 0.3 + filtered_val * 0.7, 2)
                    
        filtered_data['filtered'] = True
        filtered_data['anomaly'] = is_anomaly
        
        return filtered_data
