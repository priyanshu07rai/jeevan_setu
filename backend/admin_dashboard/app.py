import streamlit as st
import pandas as pd
import psycopg2
import os
import time

# Styling configurations (Design Aesthetics)
st.set_page_config(
    page_title="Disaster Operations Center",
    page_icon="🚨",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Premium UI CSS injection
st.markdown("""
    <style>
    .metric-card {
        background-color: #1e1e2f;
        border-radius: 12px;
        padding: 20px;
        color: #ffffff;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        text-align: center;
        transition: transform 0.2s;
    }
    .metric-card:hover {
        transform: translateY(-5px);
    }
    .metric-value {
        font-size: 36px;
        font-weight: bold;
        color: #00d2ff;
        margin: 10px 0;
    }
    .metric-label {
        font-size: 14px;
        color: #aaaaaa;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    .stApp {
        background: linear-gradient(135deg, #0f2027, #203a43, #2c5364);
        color: white;
    }
    </style>
""", unsafe_allow_html=True)

# Database connection
@st.cache_resource
def init_connection():
    return psycopg2.connect(os.environ.get('DATABASE_URL', 'postgresql://user:password@localhost:5432/disaster_db'))

conn = init_connection()

def run_query(query):
    with conn.cursor() as cur:
        cur.execute(query)
        columns = [desc[0] for desc in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=columns)

st.title("🚨 Disaster Data Ingestion Operations Dashboard")
st.markdown("Real-time telemetry and overview of incoming distress signals. Refreshes every 10 seconds.")

placeholder = st.empty()

while True:
    try:
        # Fetching telemetry data
        metrics_df = run_query("SELECT COUNT(*) as total, SUM(CASE WHEN is_duplicate THEN 1 ELSE 0 END) as dupes, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending FROM reports")
        
        # Pipeline Data
        pipeline_df = run_query("SELECT processing_stage, COUNT(*) as count FROM reports GROUP BY processing_stage")
        
        # Locations Data
        location_df = run_query("SELECT location_text, COUNT(*) as report_count FROM reports WHERE location_text IS NOT NULL GROUP BY location_text ORDER BY report_count DESC LIMIT 5")
        
        # Failed Workers
        failures_df = run_query("SELECT COUNT(*) as failed_tasks FROM failed_tasks")

        with placeholder.container():
            col1, col2, col3, col4 = st.columns(4)
            
            with col1:
                st.markdown(f'<div class="metric-card"><div class="metric-label">Total Reports</div><div class="metric-value">{metrics_df["total"][0]}</div></div>', unsafe_allow_html=True)
            with col2:
                st.markdown(f'<div class="metric-card"><div class="metric-label">Pending / Queued</div><div class="metric-value">{metrics_df["pending"][0]}</div></div>', unsafe_allow_html=True)
            with col3:
                st.markdown(f'<div class="metric-card"><div class="metric-label">Spam / Duplicates blocked</div><div class="metric-value">{metrics_df["dupes"][0]}</div></div>', unsafe_allow_html=True)
            with col4:
                st.markdown(f'<div class="metric-card"><div class="metric-label">Worker Failures (DLQ)</div><div class="metric-value" style="color:#ff4b4b;">{failures_df["failed_tasks"][0]}</div></div>', unsafe_allow_html=True)

            st.write("---")
            
            row2_col1, row2_col2 = st.columns(2)
            
            # Pipeline Chart
            with row2_col1:
                st.subheader("Pipeline Stage Throughput")
                st.bar_chart(pipeline_df.set_index("processing_stage"))
                
            # Hotspots
            with row2_col2:
                st.subheader("Top Disaster Hotspots")
                st.dataframe(location_df, use_container_width=True, hide_index=True)
                
            # Confidence Metrics
            recent_conf_df = run_query("SELECT data_confidence_score FROM reports WHERE data_confidence_score IS NOT NULL ORDER BY created_at DESC LIMIT 100")
            if not recent_conf_df.empty:
                st.subheader("Data Confidence Distribution (Last 100 Reports)")
                st.line_chart(recent_conf_df)

    except Exception as e:
        st.error(f"Database connection error: {e}")
        
    time.sleep(10) # Refresh rate

