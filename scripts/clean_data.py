import pandas as pd
import numpy as np
import json
import os

# Configuration
INPUT_FILE = '/Users/hanzizheng/ntu_project/data_viz/dataset/ai_job_dataset.csv'
OUTPUT_CSV = '/Users/hanzizheng/ntu_project/data_viz/web/public/data/cleaned_ai_jobs.csv'
OUTPUT_JSON = '/Users/hanzizheng/ntu_project/data_viz/web/public/data/dashboard_stats.json'

# Exchange rates (approximate for demo)
EXCHANGE_RATES = {
    'USD': 1.0,
    'EUR': 1.08,
    'GBP': 1.27
}

def clean_data():
    print(f"Loading data from {INPUT_FILE}...")
    df = pd.read_csv(INPUT_FILE)
    initial_count = len(df)
    print(f"Initial row count: {initial_count}")

    # 1. Remove duplicates
    df.drop_duplicates(subset=['job_id'], keep='first', inplace=True)
    print(f"After removing duplicates: {len(df)}")

    # 2. Handle missing values
    # Fill missing skills with empty string
    df['required_skills'] = df['required_skills'].fillna('')
    
    # Fill missing experience with median
    if 'years_experience' in df.columns:
        median_exp = df['years_experience'].median()
        df['years_experience'].fillna(median_exp, inplace=True)
    
    # Fill missing salary with median of the same currency group, then drop if still NaN
    df['salary_usd'] = df.groupby('salary_currency')['salary_usd'].transform(lambda x: x.fillna(x.median()))
    df.dropna(subset=['salary_usd'], inplace=True)

    # 3. Currency Conversion
    def convert_salary(row):
        currency = row['salary_currency']
        amount = row['salary_usd']
        rate = EXCHANGE_RATES.get(currency, 1.0)
        return amount * rate

    df['adjusted_salary_usd'] = df.apply(convert_salary, axis=1)

    # 4. Handle Outliers (Salary) using IQR
    Q1 = df['adjusted_salary_usd'].quantile(0.25)
    Q3 = df['adjusted_salary_usd'].quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    
    # We filter out extreme outliers but keep reasonable ones for analysis
    # Let's just flag them instead of removing, or remove if requested for "clean data".
    # User said "handle outliers", usually means remove or cap. I'll remove extreme ones.
    df = df[(df['adjusted_salary_usd'] >= lower_bound) & (df['adjusted_salary_usd'] <= upper_bound)]
    print(f"After removing salary outliers: {len(df)}")

    # 5. Text Processing (Skills)
    all_skills = []
    for skills_str in df['required_skills']:
        if isinstance(skills_str, str):
            # Split by comma and strip whitespace
            skills = [s.strip() for s in skills_str.split(',')]
            all_skills.extend(skills)
    
    # Count skill frequency
    skill_counts = pd.Series(all_skills).value_counts().reset_index()
    skill_counts.columns = ['name', 'value']
    
    # Top 50 skills for word cloud
    top_skills = skill_counts.head(50).to_dict('records')

    # 6. Prepare Dashboard Data
    
    # Job Distribution by Title (Top 10)
    job_dist = df['job_title'].value_counts().head(10).sort_values(ascending=True).reset_index()
    job_dist.columns = ['name', 'value']
    
    # Job Distribution by Location (Top 10)
    loc_dist = df['company_location'].value_counts().head(10).sort_values(ascending=True).reset_index()
    loc_dist.columns = ['name', 'value']

    # Salary Distribution (Histogram data)
    # We'll compute bins here or let frontend do it. Let's send raw salary list for flexibility or bins.
    # Sending bins is safer for JSON size.
    salary_hist, salary_bins = np.histogram(df['adjusted_salary_usd'], bins=20)
    salary_distribution = {
        'bins': salary_bins.tolist(),
        'counts': salary_hist.tolist()
    }
    
    # Average Salary by Experience Level
    exp_order = ['EN', 'MI', 'SE', 'EX']
    avg_salary_exp = df.groupby('experience_level')['adjusted_salary_usd'].mean().reindex(exp_order).reset_index()
    avg_salary_exp.columns = ['name', 'value']

    # --- New Analysis Dimensions ---

    # 7. Temporal Analysis (Job Postings Trend)
    if 'posting_date' in df.columns:
        df['posting_date'] = pd.to_datetime(df['posting_date'], errors='coerce')
        df['month_year'] = df['posting_date'].dt.to_period('M').astype(str)
        job_trend = df['month_year'].value_counts().sort_index().reset_index()
        job_trend.columns = ['name', 'value']
    else:
        job_trend = pd.DataFrame(columns=['name', 'value'])

    # 8. Univariate Analysis (Categorical)
    size_order = ['S', 'M', 'L']
    company_size_dist = df['company_size'].value_counts().reindex(size_order).reset_index()
    company_size_dist.columns = ['name', 'value']

    remote_ratio_dist = df['remote_ratio'].value_counts().sort_index().reset_index()
    remote_ratio_dist.columns = ['name', 'value']
    
    # 9. Bivariate Analysis
    # Salary by Company Size
    avg_salary_size = df.groupby('company_size')['adjusted_salary_usd'].mean().reindex(size_order).reset_index()
    avg_salary_size.columns = ['name', 'value']

    # Salary by Remote Ratio
    avg_salary_remote = df.groupby('remote_ratio')['adjusted_salary_usd'].mean().sort_index().reset_index()
    avg_salary_remote.columns = ['name', 'value']

    # Salary by Location (Top 10) - Boxplot data preparation could be complex, let's do avg for now
    avg_salary_loc = df.groupby('company_location')['adjusted_salary_usd'].mean().sort_values(ascending=True).tail(15).reset_index()
    avg_salary_loc.columns = ['name', 'value']

    # --- Enhanced Analysis (New Tabs) ---
    
    # 10. Statistical Distribution (Boxplot Data)
    def calculate_boxplot_data(group_df):
        stats = group_df.describe()
        return {
            'min': stats['min'],
            'q1': stats['25%'],
            'median': stats['50%'],
            'q3': stats['75%'],
            'max': stats['max']
        }

    # Overall Salary Boxplot
    overall_stats = df['adjusted_salary_usd'].describe()
    salary_boxplot = {
        'overall': {
            'categories': ['Overall'],
            'box_data': [[
                overall_stats['min'], 
                overall_stats['25%'], 
                overall_stats['50%'], 
                overall_stats['75%'], 
                overall_stats['max']
            ]],
            'outliers': [[0, val] for val in df[(df['adjusted_salary_usd'] < overall_stats['25%'] - 1.5*(overall_stats['75%']-overall_stats['25%'])) | 
                                                (df['adjusted_salary_usd'] > overall_stats['75%'] + 1.5*(overall_stats['75%']-overall_stats['25%']))]['adjusted_salary_usd'].tolist()]
        }
    }

    # Grouped Boxplots
    # By Experience Level
    exp_order = ['EN', 'MI', 'SE', 'EX'] # Logical order
    exp_box_data = []
    exp_outliers = []
    
    for i, level in enumerate(exp_order):
        group = df[df['experience_level'] == level]['adjusted_salary_usd']
        if not group.empty:
            s = group.describe()
            exp_box_data.append([s['min'], s['25%'], s['50%'], s['75%'], s['max']])
            
            # Outliers for this group
            iqr = s['75%'] - s['25%']
            lower = s['25%'] - 1.5 * iqr
            upper = s['75%'] + 1.5 * iqr
            group_outliers = group[(group < lower) | (group > upper)].tolist()
            for out in group_outliers:
                exp_outliers.append([i, out])
        else:
            exp_box_data.append([0, 0, 0, 0, 0]) # Placeholder or handle empty

    salary_boxplot['by_experience'] = {
        'categories': exp_order,
        'box_data': exp_box_data,
        'outliers': exp_outliers
    }

    # By Company Size
    size_order = ['S', 'M', 'L']
    size_box_data = []
    size_outliers = []
    
    for i, size in enumerate(size_order):
        group = df[df['company_size'] == size]['adjusted_salary_usd']
        if not group.empty:
            s = group.describe()
            size_box_data.append([s['min'], s['25%'], s['50%'], s['75%'], s['max']])
            
            iqr = s['75%'] - s['25%']
            lower = s['25%'] - 1.5 * iqr
            upper = s['75%'] + 1.5 * iqr
            group_outliers = group[(group < lower) | (group > upper)].tolist()
            for out in group_outliers:
                size_outliers.append([i, out])
        else:
            size_box_data.append([0, 0, 0, 0, 0])

    salary_boxplot['by_company_size'] = {
        'categories': size_order,
        'box_data': size_box_data,
        'outliers': size_outliers
    }

    # By Remote Ratio
    # remote_ratio is numeric but categorical in nature (0, 50, 100)
    remote_cats = sorted(df['remote_ratio'].unique())
    remote_box_data = []
    remote_outliers = []
    
    for i, ratio in enumerate(remote_cats):
        group = df[df['remote_ratio'] == ratio]['adjusted_salary_usd']
        if not group.empty:
            s = group.describe()
            remote_box_data.append([s['min'], s['25%'], s['50%'], s['75%'], s['max']])
            
            iqr = s['75%'] - s['25%']
            lower = s['25%'] - 1.5 * iqr
            upper = s['75%'] + 1.5 * iqr
            group_outliers = group[(group < lower) | (group > upper)].tolist()
            for out in group_outliers:
                remote_outliers.append([i, out])
        else:
            remote_box_data.append([0, 0, 0, 0, 0])

    salary_boxplot['by_remote_ratio'] = {
        'categories': [str(r) for r in remote_cats],
        'box_data': remote_box_data,
        'outliers': remote_outliers
    }

    # 11. Correlation Analysis
    # Encode categorical variables for correlation
    df_encoded = df.copy()
    
    # Simple mapping for ordinal/nominal
    exp_map = {'EN': 1, 'MI': 2, 'SE': 3, 'EX': 4}
    size_map = {'S': 1, 'M': 2, 'L': 3}
    
    df_encoded['experience_level_num'] = df_encoded['experience_level'].map(exp_map).fillna(0)
    df_encoded['company_size_num'] = df_encoded['company_size'].map(size_map).fillna(0)
    
    corr_cols = ['adjusted_salary_usd', 'years_experience', 'remote_ratio', 'experience_level_num', 'company_size_num']
    corr_matrix = df_encoded[corr_cols].corr().round(2)
    
    # Format for Heatmap [x, y, value]
    corr_data = []
    for i, row_idx in enumerate(corr_matrix.index):
        for j, col_idx in enumerate(corr_matrix.columns):
            corr_data.append([i, j, corr_matrix.loc[row_idx, col_idx]])
            
    corr_labels = corr_cols

    # 12. Geographic Intelligence (Full Map Data)
    # We already have geo_data, but let's add avg salary per country
    geo_salary = df.groupby('company_location')['adjusted_salary_usd'].mean().sort_values(ascending=True).reset_index()
    geo_salary.columns = ['name', 'value']

    # Map country codes to approximate lat/lon for visual map (simplified)
    # In a real app, frontend would map ISO codes to map geojson. 
    # Here we just prepare the data cleanly.
    
    # 13. Industry Insights
    industry_salary = df.groupby('industry')['adjusted_salary_usd'].agg(['mean', 'count']).reset_index()
    industry_salary.columns = ['name', 'avg_salary', 'job_count']
    industry_salary = industry_salary.sort_values('avg_salary', ascending=True).tail(15)
    
    # 14. Skills Network (Co-occurrence)
    # This is expensive, so we sample or limit to top skills
    top_20_skills = [s['name'] for s in top_skills[:20]]
    co_occurrence = {s: {s2: 0 for s2 in top_20_skills} for s in top_20_skills}
    
    for skills_str in df['required_skills']:
        if isinstance(skills_str, str):
            current_skills = [s.strip() for s in skills_str.split(',') if s.strip() in top_20_skills]
            for i in range(len(current_skills)):
                for j in range(i + 1, len(current_skills)):
                    s1, s2 = current_skills[i], current_skills[j]
                    co_occurrence[s1][s2] += 1
                    co_occurrence[s2][s1] += 1
                    
    # Format nodes and links for ECharts Graph
    nodes = [{'name': s, 'value': next((x['value'] for x in top_skills if x['name'] == s), 10), 'symbolSize': np.log(next((x['value'] for x in top_skills if x['name'] == s), 10))*5} for s in top_20_skills]
    links = []
    for s1 in top_20_skills:
        for s2 in top_20_skills:
            if s1 < s2 and co_occurrence[s1][s2] > 0:
                links.append({'source': s1, 'target': s2, 'value': co_occurrence[s1][s2]})

    dashboard_data = {
        'stats': {
            'total_jobs': int(len(df)),
            'avg_salary': float(df['adjusted_salary_usd'].mean()),
            'avg_experience': float(df['years_experience'].mean())
        },
        'job_distribution': job_dist.to_dict('records'),
        'location_distribution': loc_dist.to_dict('records'),
        'salary_distribution': salary_distribution,
        'skill_cloud': top_skills,
        'avg_salary_by_experience': avg_salary_exp.to_dict('records'),
        # New Data
        'job_trend': job_trend.to_dict('records'),
        'company_size_distribution': company_size_dist.to_dict('records'),
        'remote_ratio_distribution': remote_ratio_dist.to_dict('records'),
        'avg_salary_by_company_size': avg_salary_size.to_dict('records'),
        'avg_salary_by_remote_ratio': avg_salary_remote.to_dict('records'),
        'avg_salary_by_location': avg_salary_loc.to_dict('records'),
        'geo_data': df['company_location'].value_counts().reset_index().rename(columns={'index':'name', 'company_location':'value'}).to_dict('records'),
        # Enhanced Data
        'salary_boxplot': salary_boxplot,
        'correlation': {'data': corr_data, 'labels': corr_labels},
        'geo_salary': geo_salary.to_dict('records'),
        'industry_insights': industry_salary.to_dict('records'),
        'skills_network': {'nodes': nodes, 'links': links}
    }

    # Save outputs
    os.makedirs(os.path.dirname(OUTPUT_CSV), exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False)
    print(f"Cleaned data saved to {OUTPUT_CSV}")

    with open(OUTPUT_JSON, 'w') as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"Dashboard data saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    clean_data()
