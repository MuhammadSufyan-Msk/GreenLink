import os

MODEL_DIR = os.path.dirname(__file__)

def convert_tflite_to_c_array(tflite_path, c_file_path, h_file_path, array_name):
    if not os.path.exists(tflite_path):
        print(f"Error: {tflite_path} not found.")
        return

    with open(tflite_path, 'rb') as f:
        tflite_content = f.read()

    # Create the C source file
    with open(c_file_path, 'w') as f:
        f.write('#include "model_data.h"\n\n')
        f.write(f'const unsigned char {array_name}[] = {{\n')
        
        hex_array = [f'0x{byte:02x}' for byte in tflite_content]
        for i in range(0, len(hex_array), 12):
            f.write('  ' + ', '.join(hex_array[i:i+12]) + ',\n')
            
        f.write('};\n\n')
        f.write(f'const unsigned int {array_name}_len = {len(tflite_content)};\n')

    # Create the C header file
    with open(h_file_path, 'w') as f:
        f.write('#ifndef MODEL_DATA_H\n')
        f.write('#define MODEL_DATA_H\n\n')
        f.write(f'extern const unsigned char {array_name}[];\n')
        f.write(f'extern const unsigned int {array_name}_len;\n\n')
        f.write('#endif // MODEL_DATA_H\n')
        
    print(f"Converted {tflite_path} to {c_file_path} and {h_file_path}")

def main():
    # Convert Urban Model
    urban_tflite = os.path.join(MODEL_DIR, 'urban_model.tflite')
    urban_dest_dir = os.path.join(MODEL_DIR, '..', '..', 'firmware', 'esp32-urban', 'src')
    os.makedirs(urban_dest_dir, exist_ok=True)
    convert_tflite_to_c_array(
        urban_tflite,
        os.path.join(urban_dest_dir, 'model_data.cpp'),
        os.path.join(urban_dest_dir, 'model_data.h'),
        'urban_model_tflite'
    )

    # Convert Rural Model
    rural_tflite = os.path.join(MODEL_DIR, 'rural_model.tflite')
    rural_dest_dir = os.path.join(MODEL_DIR, '..', '..', 'firmware', 'esp32-rural', 'src')
    os.makedirs(rural_dest_dir, exist_ok=True)
    convert_tflite_to_c_array(
        rural_tflite,
        os.path.join(rural_dest_dir, 'model_data.cpp'),
        os.path.join(rural_dest_dir, 'model_data.h'),
        'rural_model_tflite'
    )

if __name__ == '__main__':
    main()
