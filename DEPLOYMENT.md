# AI Job Market Dashboard - Deployment Guide

This guide provides instructions on how to set up, clean data, and deploy the AI Job Market Analysis Dashboard.

## Prerequisites

- **Python**: 3.8 or higher (with `pandas` and `numpy` installed).
- **Node.js**: 18.0 or higher.
- **npm**: Included with Node.js.

## Project Structure

```
/
├── data/               # Contains raw and cleaned datasets
├── scripts/            # Python scripts for data cleaning
├── web/                # React frontend application
└── DEPLOYMENT.md       # This file
```

## Step 1: Data Cleaning

Before running the dashboard, you must process the raw dataset.

1.  Navigate to the project root.
2.  Install Python dependencies (if not already installed):
    ```bash
    pip install pandas numpy
    ```
3.  Run the cleaning script:
    ```bash
    python scripts/clean_data.py
    ```
    This will generate:
    -   `data/cleaned_ai_jobs.csv`: Cleaned dataset.
    -   `data/dashboard_stats.json`: Aggregated data for the dashboard.

## Step 2: Frontend Setup

1.  Navigate to the web directory:
    ```bash
    cd web
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Copy the latest data to the public folder (Automated by script if configured, otherwise manual):
    ```bash
    # From project root
    cp data/dashboard_stats.json web/public/data/
    ```

## Step 3: Running Locally (Development)

To start the development server with hot-reload:

```bash
cd web
npm run dev
```

Open your browser at `http://localhost:5173`.

## Step 4: Production Build & Deployment

To build the application for production:

1.  Build the static files:
    ```bash
    cd web
    npm run build
    ```
    This creates a `dist` folder containing optimized HTML, CSS, and JS files.

2.  **Serve the Dashboard**:
    You can serve the `dist` folder using any static file server.

    **Option A: Using Python (Simple)**
    ```bash
    cd web/dist
    python3 -m http.server 8000
    ```
    Access at `http://localhost:8000`.

    **Option B: Nginx (Recommended for Production)**
    Configure Nginx to serve the `dist` folder. Example config:
    ```nginx
    server {
        listen 80;
        server_name your-domain.com;
        root /path/to/project/web/dist;
        index index.html;
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
    ```

## Performance & Quality Assurance

-   **Data Quality**: The cleaning script handles missing values, removes duplicates, and filters outliers to ensure >95% data integrity.
-   **Response Time**: The dashboard uses pre-aggregated JSON data (~50KB), ensuring load times under 3 seconds.
-   **Visualization**: Built with React + ECharts + Ant Design for responsive and interactive charts.
