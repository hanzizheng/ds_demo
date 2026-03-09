import pandas as pd

try:
    df = pd.read_csv('/Users/hanzizheng/ntu_project/data_viz/dataset/ai_job_dataset.csv')
    print("Unique currencies:", df['salary_currency'].unique())
except Exception as e:
    print(e)
