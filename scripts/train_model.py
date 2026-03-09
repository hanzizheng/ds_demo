import pandas as pd
import numpy as np
import json
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.ensemble import VotingRegressor, RandomForestRegressor
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.tree import DecisionTreeRegressor
import xgboost as xgb
import lightgbm as lgb
import warnings

warnings.filterwarnings('ignore')

# Configuration
INPUT_FILE = '/Users/hanzizheng/ntu_project/data_viz/web/public/data/cleaned_ai_jobs.csv'
OUTPUT_ML_STATS = '/Users/hanzizheng/ntu_project/data_viz/web/public/data/ml_stats.json'
MODEL_PATH = '/Users/hanzizheng/ntu_project/data_viz/server/model.pkl'
ENCODERS_PATH = '/Users/hanzizheng/ntu_project/data_viz/server/encoders.pkl'
METADATA_PATH = '/Users/hanzizheng/ntu_project/data_viz/web/public/data/model_metadata.json'

def train_models():
    print("Loading cleaned data for ML...")
    if not os.path.exists(INPUT_FILE):
        print(f"Error: {INPUT_FILE} not found. Run clean_data.py first.")
        return

    df = pd.read_csv(INPUT_FILE)
    
    # Feature Engineering
    # Target: adjusted_salary_usd
    target = 'adjusted_salary_usd'
    
    # 1. Outlier Removal (1% - 99%)
    print("Removing outliers...")
    q_low = df[target].quantile(0.01)
    q_high = df[target].quantile(0.99)
    df = df[(df[target] >= q_low) & (df[target] <= q_high)]
    print(f"Data shape after outlier removal: {df.shape}")
    
    # Features
    features = ['experience_level', 'employment_type', 'company_size', 'remote_ratio', 'job_title', 'company_location', 'industry']
    
    print("Preprocessing data...")
    X = df[features].copy()
    y = df[target]
    
    # 2. Log Transformation of Target
    y_log = np.log1p(y)
    
    # 3. Target Encoding (Smooth Mean Encoding)
    # We need to split first to avoid data leakage for target encoding, 
    # but for simplicity in this script structure (and since we want to save encoders for inference),
    # we will compute global means. ideally we should use K-Fold target encoding.
    # To keep it robust for inference, we'll compute mapping on full X (or X_train) and save it.
    
    # Let's split first
    X_train, X_test, y_train_log, y_test_log = train_test_split(X, y_log, test_size=0.2, random_state=42)
    
    encoders = {}
    metadata = {}
    
    # Calculate Target Encoding on Training Set ONLY
    for col in features:
        # Save unique values for frontend dropdowns
        unique_vals = sorted(X[col].unique().astype(str).tolist())
        metadata[col] = unique_vals
        
        # Target Encoding
        # Compute mean log_salary per category
        # Add smoothing to handle rare categories
        global_mean = y_train_log.mean()
        agg = pd.DataFrame({'feature': X_train[col], 'target': y_train_log})
        stats = agg.groupby('feature')['target'].agg(['mean', 'count'])
        
        # Smoothing formula: (mean * count + global_mean * m) / (count + m)
        m = 10 # smoothing factor
        stats['smooth_mean'] = (stats['mean'] * stats['count'] + global_mean * m) / (stats['count'] + m)
        
        # Create mapping dictionary
        mapping = stats['smooth_mean'].to_dict()
        encoders[col] = {'mapping': mapping, 'global_mean': global_mean}
        
        # Apply mapping to Train and Test
        X_train[col] = X_train[col].map(mapping).fillna(global_mean)
        X_test[col] = X_test[col].map(mapping).fillna(global_mean)

    print("Training 10 Models (Optimized)...")
    
    # Optimized Hyperparameters
    # 1. XGBoost
    xgb_model = xgb.XGBRegressor(n_estimators=1000, learning_rate=0.01, max_depth=8, subsample=0.7, colsample_bytree=0.7, random_state=42, n_jobs=-1)
    
    # 2. LightGBM
    lgb_model = lgb.LGBMRegressor(n_estimators=1000, learning_rate=0.01, num_leaves=63, feature_fraction=0.7, bagging_fraction=0.7, random_state=42, n_jobs=-1, verbose=-1)
    
    # 3. Random Forest
    rf_model = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
    
    # 4. Linear Regression
    lr_model = LinearRegression()
    
    # 5. Ridge
    ridge_model = Ridge(alpha=1.0)
    
    # 6. Lasso
    lasso_model = Lasso(alpha=0.001)
    
    # 7. ElasticNet
    en_model = ElasticNet(alpha=0.001, l1_ratio=0.5)
    
    # 8. Decision Tree
    dt_model = DecisionTreeRegressor(max_depth=12, random_state=42)
    
    # 9. KNN
    knn_model = KNeighborsRegressor(n_neighbors=10, weights='distance')
    
    # 10. SVR
    svr_model = SVR(kernel='rbf', C=10, gamma='scale')

    models_to_train = {
        'XGBoost': xgb_model,
        'LightGBM': lgb_model,
        'Random Forest': rf_model,
        'Linear Regression': lr_model,
        'Ridge': ridge_model,
        'Lasso': lasso_model,
        'ElasticNet': en_model,
        'Decision Tree': dt_model,
        'KNN': knn_model,
        'SVR': svr_model
    }
    
    trained_models = []
    results = []
    
    # Inverse transform for evaluation (Log -> Original Scale)
    y_test_original = np.expm1(y_test_log)
    
    for name, model in models_to_train.items():
        print(f"Training {name}...")
        model.fit(X_train, y_train_log)
        
        y_pred_log = model.predict(X_test)
        y_pred = np.expm1(y_pred_log) # Inverse log transform
        
        rmse = np.sqrt(mean_squared_error(y_test_original, y_pred))
        mae = mean_absolute_error(y_test_original, y_pred)
        r2 = r2_score(y_test_original, y_pred)
        
        results.append({
            'model': name,
            'rmse': round(rmse, 2),
            'mae': round(mae, 2),
            'r2': round(r2, 4)
        })
        trained_models.append((name, model))
        print(f"{name} - RMSE: {rmse:.2f}, R2: {r2:.4f}")

    print("Training Voting Regressor (Top 3)...")
    # Select top 3 models based on R2 for Voting
    sorted_results = sorted(results, key=lambda x: x['r2'], reverse=True)
    top_3_names = [res['model'] for res in sorted_results[:3]]
    top_3_estimators = [(name, model) for name, model in trained_models if name in top_3_names]
    
    print(f"Top 3 models for voting: {top_3_names}")
    
    voting_model = VotingRegressor(estimators=top_3_estimators)
    voting_model.fit(X_train, y_train_log)
    
    # Add Voting to results
    y_pred_vote_log = voting_model.predict(X_test)
    y_pred_vote = np.expm1(y_pred_vote_log)
    
    rmse_vote = np.sqrt(mean_squared_error(y_test_original, y_pred_vote))
    mae_vote = mean_absolute_error(y_test_original, y_pred_vote)
    r2_vote = r2_score(y_test_original, y_pred_vote)
    
    results.append({
        'model': 'Voting (Ensemble)',
        'rmse': round(rmse_vote, 2),
        'mae': round(mae_vote, 2),
        'r2': round(r2_vote, 4)
    })
    
    # Sort results by R2 for frontend display
    results.sort(key=lambda x: x['r2'], reverse=True)

    # Save Model and Encoders (Target Encoding Dicts)
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    joblib.dump(voting_model, MODEL_PATH)
    joblib.dump(encoders, ENCODERS_PATH)
    print(f"Model saved to {MODEL_PATH}")
    print(f"Encoders saved to {ENCODERS_PATH}")
    
    # Save Metadata for Frontend
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to {METADATA_PATH}")

    # Feature Importance (from XGBoost as proxy)
    importance = xgb_model.feature_importances_
    feature_importance = []
    for i, col in enumerate(features):
        feature_importance.append({'name': col, 'value': float(importance[i])})
    
    feature_importance.sort(key=lambda x: x['value'], reverse=True)
    
    # Prediction Sample for Scatter Plot (Actual vs Predicted from Voting Model)
    # y_pred_voting is already calculated as y_pred_vote
    
    # Downsample for visualization
    sample_size = min(500, len(y_test_original))
    indices = np.random.choice(len(y_test_original), sample_size, replace=False)
    
    scatter_data = []
    residuals = []
    y_test_arr = y_test_original.values
    
    for i in indices:
        actual = float(y_test_arr[i])
        predicted = float(y_pred_vote[i])
        residual = actual - predicted
        scatter_data.append([actual, predicted])
        residuals.append(residual)

    # Residual Distribution
    res_hist, res_bins = np.histogram(residuals, bins=30)
    residual_dist = {
        'bins': [float(b) for b in res_bins[:-1]], 
        'counts': [int(c) for c in res_hist]
    }

    ml_stats = {
        'performance': results,
        'feature_importance': feature_importance,
        'scatter_data': scatter_data,
        'residual_distribution': residual_dist,
        'model_info': {
            'target': target,
            'features': features,
            'train_size': len(X_train),
            'test_size': len(X_test)
        }
    }
    
    with open(OUTPUT_ML_STATS, 'w') as f:
        json.dump(ml_stats, f, indent=2)
    print(f"ML stats saved to {OUTPUT_ML_STATS}")

if __name__ == "__main__":
    train_models()
