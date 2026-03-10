from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import os
import math

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Vercel file path handling
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'model.pkl')
ENCODERS_PATH = os.path.join(os.path.dirname(__file__), 'encoders.pkl')

# Load model and encoders
model = None
encoders = None

def load_models():
    global model, encoders
    if model is None:
        try:
            print(f"Loading model from {MODEL_PATH}")
            model = joblib.load(MODEL_PATH)
            encoders = joblib.load(ENCODERS_PATH)
            print("Model loaded successfully.")
        except Exception as e:
            print(f"Error loading model: {e}")

@app.route('/api/predict', methods=['POST'])
def predict():
    load_models()
    if not model or not encoders:
        return jsonify({'error': 'Model not loaded'}), 500
    
    try:
        data = request.json
        features = ['experience_level', 'employment_type', 'company_size', 'remote_ratio', 'job_title', 'company_location', 'industry']
        
        # Prepare input as a list of lists (what sklearn expects)
        # Instead of pandas DataFrame, we construct the input array directly
        # But wait, the model was trained with DataFrame feature names?
        # XGBoost/LightGBM/Sklearn might warn or fail if feature names missing if trained with DF.
        # However, usually passing a 2D numpy-like array (list of lists) works if order is correct.
        
        input_row = []
        
        for feature in features:
            val = data.get(feature)
            if val is None:
                return jsonify({'error': f'Missing feature: {feature}'}), 400
            
            # Target Encoding Logic using raw dicts
            val_str = str(val)
            encoder_info = encoders.get(feature)
            
            if encoder_info:
                mapping = encoder_info['mapping']
                global_mean = encoder_info['global_mean']
                
                # Map value, fallback to global mean
                encoded_val = mapping.get(val_str, global_mean)
                input_row.append(encoded_val)
            else:
                 return jsonify({'error': f'Encoder not found for {feature}'}), 500
        
        # Predict
        # input_row is [f1, f2, ...]
        # model.predict expects [[f1, f2, ...]]
        
        # Note: If model strictly requires pandas, we might need a workaround. 
        # But VotingRegressor usually handles array-like inputs.
        # Let's try passing list of lists.
        
        # IMPORTANT: XGBoost/LightGBM sometimes are picky about feature names if trained with them.
        # If this fails, we might need a lightweight way to wrap it, but usually standard sklearn interface accepts arrays.
        
        log_prediction = model.predict([input_row])[0]
        
        # Inverse Transform (Log -> Original): expm1
        prediction = math.exp(log_prediction) - 1
        
        return jsonify({
            'predicted_salary': round(float(prediction), 2),
            'currency': 'USD'
        })

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({'error': str(e)}), 500
