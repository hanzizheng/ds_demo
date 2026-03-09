from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

MODEL_PATH = 'server/model.pkl'
ENCODERS_PATH = 'server/encoders.pkl'

# Load model and encoders at startup
print("Loading model and encoders...")
try:
    model = joblib.load(MODEL_PATH)
    encoders = joblib.load(ENCODERS_PATH)
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None
    encoders = None

@app.route('/api/predict', methods=['POST'])
def predict():
    if not model or not encoders:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        data = request.json
        features = ['experience_level', 'employment_type', 'company_size', 'remote_ratio', 'job_title', 'company_location', 'industry']
        
        # Prepare input DataFrame
        input_data = {}
        for feature in features:
            val = data.get(feature)
            if val is None:
                return jsonify({'error': f'Missing feature: {feature}'}), 400
            input_data[feature] = [val]
            
        df = pd.DataFrame(input_data)
        
        # Encode features (Target Encoding Logic)
        for col in features:
            val = str(df[col][0])
            encoder_info = encoders.get(col)
            
            if encoder_info:
                mapping = encoder_info['mapping']
                global_mean = encoder_info['global_mean']
                
                # Map value, fallback to global mean if unknown
                encoded_val = mapping.get(val, global_mean)
                df[col] = encoded_val
            else:
                 return jsonify({'error': f'Encoder not found for {col}'}), 500
                
        # Predict (Result is in Log scale)
        log_prediction = model.predict(df)[0]
        
        # Inverse Transform (Log -> Original)
        prediction = np.expm1(log_prediction)
        
        return jsonify({
            'predicted_salary': round(float(prediction), 2),
            'currency': 'USD'
        })

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(port=5001, debug=True)
