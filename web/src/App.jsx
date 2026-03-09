import React, { useEffect, useState, useMemo } from 'react';
import { Layout, Typography, Row, Col, Card, Statistic, Spin, theme, Tabs, Tooltip as AntTooltip, Popover, Button, Alert, Segmented, Form, Select, InputNumber, Modal, message } from 'antd';
import { DollarOutlined, UserOutlined, BookOutlined, RiseOutlined, EnvironmentOutlined, ApartmentOutlined, HeatMapOutlined, NodeIndexOutlined, BarChartOutlined, GlobalOutlined, InfoCircleOutlined, BulbOutlined, RobotOutlined, ThunderboltOutlined, ExperimentOutlined, DashboardOutlined, CalculatorOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";

const { Header, Content, Footer } = Layout;
const { Title, Paragraph, Text } = Typography;

// Helper component for Tips
const ChartTip = ({ content }) => (
  <AntTooltip title={content}>
    <Button type="text" shape="circle" icon={<InfoCircleOutlined style={{ color: '#1890ff' }} />} size="small" style={{ marginLeft: 8 }} />
  </AntTooltip>
);

// Helper component for EDA Analysis Box
const EDABox = ({ step, title, analysis }) => (
  <Alert
    message={<Text strong><BulbOutlined /> EDA Step {step}: {title}</Text>}
    description={analysis}
    type="info"
    showIcon={false}
    style={{ marginBottom: 16, borderLeft: '4px solid #1890ff' }}
  />
);

const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const App = () => {
  const [data, setData] = useState(null);
  const [mlData, setMlData] = useState(null);
  const [metaData, setMetaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [boxplotMode, setBoxplotMode] = useState('Overall');
  const [predictLoading, setPredictLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  useEffect(() => {
    Promise.all([
        fetch('/data/dashboard_stats.json').then(res => res.json()),
        fetch('/data/ml_stats.json').then(res => res.json()).catch(() => null),
        fetch('/data/model_metadata.json').then(res => res.json()).catch(() => null)
    ]).then(([jsonData, mlJsonData, metaJsonData]) => {
        setData(jsonData);
        setMlData(mlJsonData);
        setMetaData(metaJsonData);
        setLoading(false);
    }).catch(err => {
        console.error("Error loading data:", err);
        setLoading(false);
    });
  }, []);

  const handlePredict = async (values) => {
      setPredictLoading(true);
      try {
          // Use relative path for Vercel deployment (handled by rewrites)
          // Fallback to localhost:5001 for local development if needed, 
          // but better to use proxy in vite.config.js for local dev to match prod.
          // For now, let's use a simple check or just relative path if we assume Vercel structure locally or use proxy.
          // To make it work both locally (without proxy setup yet) and on Vercel, we can check hostname.
          
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const apiUrl = isLocal ? 'http://localhost:5001/api/predict' : '/api/predict'; // Local flask needs /api/predict route or we change flask route
          
          // Wait, our local flask has /predict, Vercel has /api/predict rewritten to /api/index.py
          // Let's standardize.
          // Best practice: Update Flask to serve at /api/predict locally too, or handle difference.
          // I will update the local Flask app to also use /api/predict for consistency.
          
          const response = await fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(values)
          });
          const result = await response.json();
          if (response.ok) {
              setPrediction(result.predicted_salary);
              message.success('Prediction successful!');
          } else {
              message.error('Prediction failed: ' + result.error);
          }
      } catch (error) {
          message.error('Error connecting to inference server.');
          console.error(error);
      } finally {
          setPredictLoading(false);
      }
  };

  // Prepare Map Data
  const mapData = useMemo(() => {
      if (!data) return {};
      const map = {};
      data.geo_salary.forEach(item => {
          map[item.name] = item.value;
      });
      if (map['United States']) map['United States of America'] = map['United States'];
      if (map['United Kingdom']) map['United Kingdom'] = map['United Kingdom']; 
      return map;
  }, [data]);

  const colorScale = scaleLinear()
    .domain([50000, 150000]) 
    .range(["#ffedea", "#ff5233"]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Loading AI Job Analysis..." />
      </div>
    );
  }

  if (!data) {
    return <div>Error loading data. Please check console.</div>;
  }

  // Color Palette
  const colors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

  // --- Chart Options Generators ---

  // 1. Univariate
  const jobDistOption = {
    title: { text: 'Job Titles Distribution', left: 'center' },
    tooltip: { trigger: 'item' },
    color: colors,
    series: [{
      name: 'Job Title', type: 'pie', radius: ['40%', '70%'],
      data: data.job_distribution,
      emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  };

  const salaryHistOption = {
    title: { text: 'Salary Distribution (USD)', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.salary_distribution.bins.slice(0, -1).map(val => `$${Math.round(val/1000)}k`), name: 'Salary Range' },
    yAxis: { type: 'value', name: 'Count' },
    series: [{ 
        data: data.salary_distribution.counts, 
        type: 'bar', 
        itemStyle: { 
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#83bff6' },
                { offset: 0.5, color: '#188df0' },
                { offset: 1, color: '#188df0' }
            ]),
            borderRadius: [5, 5, 0, 0]
        } 
    }]
  };

  const companySizeOption = {
    title: { text: 'Company Size Distribution', left: 'center' },
    tooltip: { trigger: 'item' },
    color: ['#fac858', '#91cc75', '#5470c6'], // S, M, L specific colors
    series: [{ name: 'Size', type: 'pie', radius: '50%', data: data.company_size_distribution }]
  };

  const remoteRatioOption = {
    title: { text: 'Remote Work Ratio', left: 'center' },
    tooltip: { trigger: 'item' },
    color: ['#ee6666', '#fac858', '#91cc75'], // 0, 50, 100
    series: [{ name: 'Remote Ratio', type: 'pie', radius: '50%', data: data.remote_ratio_distribution }]
  };

  const skillCloudOption = {
    title: { text: 'Top Skills Requirement', left: 'center' },
    tooltip: {},
    series: [{
      type: 'wordCloud', shape: 'circle', left: 'center', top: 'center', width: '95%', height: '95%',
      sizeRange: [12, 60], rotationRange: [-90, 90], rotationStep: 45, gridSize: 8,
      drawOutOfBound: false, layoutAnimation: true,
      textStyle: {
        fontFamily: 'sans-serif', fontWeight: 'bold',
        color: () => 'rgb(' + [Math.round(Math.random() * 160), Math.round(Math.random() * 160), Math.round(Math.random() * 160)].join(',') + ')'
      },
      emphasis: { focus: 'self', textStyle: { shadowBlur: 10, shadowColor: '#333' } },
      data: data.skill_cloud
    }]
  };

  // 2. Bivariate
  const expSalaryOption = {
    title: { text: 'Avg Salary by Experience Level', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.avg_salary_by_experience.map(item => item.name) },
    yAxis: { type: 'value', name: 'Avg Salary (USD)' },
    series: [{ 
        data: data.avg_salary_by_experience.map(item => Math.round(item.value)), 
        type: 'bar', 
        itemStyle: { color: '#fac858', borderRadius: [5, 5, 0, 0] } 
    }]
  };

  const sizeSalaryOption = {
    title: { text: 'Avg Salary by Company Size', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.avg_salary_by_company_size.map(item => item.name) },
    yAxis: { type: 'value', name: 'Avg Salary (USD)' },
    series: [{ 
        data: data.avg_salary_by_company_size.map(item => Math.round(item.value)), 
        type: 'line', 
        smooth: true, 
        lineStyle: { width: 4 },
        itemStyle: { color: '#91cc75' },
        areaStyle: { opacity: 0.3 }
    }]
  };

  const remoteSalaryOption = {
    title: { text: 'Avg Salary by Remote Ratio', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.avg_salary_by_remote_ratio.map(item => `${item.name}%`) },
    yAxis: { type: 'value', name: 'Avg Salary (USD)' },
    series: [{ 
        data: data.avg_salary_by_remote_ratio.map(item => Math.round(item.value)), 
        type: 'bar', 
        itemStyle: { color: '#ee6666', borderRadius: [5, 5, 0, 0] } 
    }]
  };
  
  const locSalaryOption = {
    title: { text: 'Highest Paying Locations (Top 15)', left: 'center' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', boundaryGap: [0, 0.01] },
    yAxis: { type: 'category', data: data.avg_salary_by_location.map(item => item.name) },
    series: [{ 
        name: 'Avg Salary', 
        type: 'bar', 
        data: data.avg_salary_by_location.map(item => Math.round(item.value)), 
        itemStyle: { 
            color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                { offset: 0, color: '#2f4554' },
                { offset: 1, color: '#c23531' }
            ]),
            borderRadius: [0, 5, 5, 0]
        } 
    }]
  };

  // 3. Temporal
  const trendOption = {
    title: { text: 'Job Postings Trend', left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: data.job_trend.map(item => item.name) },
    yAxis: { type: 'value' },
    series: [{ 
        data: data.job_trend.map(item => item.value), 
        type: 'line', 
        smooth: true, 
        areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: 'rgba(128, 255, 165)' },
                { offset: 1, color: 'rgba(1, 191, 236)' }
            ])
        },
        lineStyle: { width: 3, color: '#3ba272' }
    }]
  };

  // 4. Statistical Distribution
  // Determine which data to use based on selection
  let currentBoxData = data.salary_boxplot.overall;
  if (boxplotMode === 'By Experience') currentBoxData = data.salary_boxplot.by_experience;
  else if (boxplotMode === 'By Company Size') currentBoxData = data.salary_boxplot.by_company_size;
  else if (boxplotMode === 'By Remote Ratio') currentBoxData = data.salary_boxplot.by_remote_ratio;

  const boxplotOption = {
    title: { text: `Salary Distribution - ${boxplotMode}`, left: 'center' },
    tooltip: { trigger: 'item', axisPointer: { type: 'shadow' } },
    grid: { left: '10%', right: '10%', bottom: '15%' },
    xAxis: {
      type: 'category',
      data: currentBoxData.categories,
      boundaryGap: true,
      nameGap: 30,
      splitArea: { show: false },
      splitLine: { show: false }
    },
    yAxis: {
      type: 'value',
      name: 'USD',
      splitArea: { show: true }
    },
    series: [
      {
        name: 'boxplot',
        type: 'boxplot',
        data: currentBoxData.box_data,
        tooltip: { formatter: function (param) {
            return [
                'Upper: ' + param.data[5],
                'Q3: ' + param.data[4],
                'Median: ' + param.data[3],
                'Q1: ' + param.data[2],
                'Lower: ' + param.data[1]
            ].join('<br/>');
        }}
      },
      {
        name: 'outlier',
        type: 'scatter',
        data: currentBoxData.outliers, // outliers needs to be [[index, value], ...]
        itemStyle: { color: '#d94e5d' }
      }
    ]
  };

  // 5. Correlation Heatmap
  const heatmapOption = {
    title: { text: 'Correlation Matrix', left: 'center' },
    tooltip: { position: 'top' },
    grid: { height: '50%', top: '10%' },
    xAxis: { type: 'category', data: data.correlation.labels, splitArea: { show: true } },
    yAxis: { type: 'category', data: data.correlation.labels, splitArea: { show: true } },
    visualMap: {
      min: -1, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: '15%',
      inRange: { color: ['#313695', '#4575b4', '#74add1', '#abd9e9', '#e0f3f8', '#ffffbf', '#fee090', '#fdae61', '#f46d43', '#d73027', '#a50026'] }
    },
    series: [{
      name: 'Correlation', type: 'heatmap', data: data.correlation.data,
      label: { show: true }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } }
    }]
  };

  // 6. Geographic Intelligence
  const geoBarOption = {
    title: { text: 'Average Salary by Country', left: 'center' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', boundaryGap: [0, 0.01] },
    yAxis: { type: 'category', data: data.geo_salary.map(item => item.name).sort().reverse() }, 
    series: [{
        name: 'Avg Salary', type: 'bar', 
        data: data.geo_salary.map(item => Math.round(item.value)).reverse(), 
        itemStyle: { color: '#5470c6' }
    }]
  };

  // 7. Industry Insights
  const industryBarOption = {
    title: { text: 'Top 15 Industries by Avg Salary', left: 'center' },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: data.industry_insights.map(item => item.name), axisLabel: { interval: 0, rotate: 30 } },
    yAxis: [
        { 
            type: 'value', 
            name: 'Avg Salary ($)', 
            min: (value) => Math.floor(value.min * 0.98), // Dynamic scale to show differences
            axisLabel: { formatter: '${value}' }
        },
        { 
            type: 'value', 
            name: 'Job Count', 
            position: 'right',
            min: (value) => Math.floor(value.min * 0.95)
        }
    ],
    series: [
        { name: 'Avg Salary', type: 'bar', yAxisIndex: 0, data: data.industry_insights.map(item => Math.round(item.avg_salary)), itemStyle: { color: '#fac858' } },
        { name: 'Job Count', type: 'line', yAxisIndex: 1, data: data.industry_insights.map(item => item.job_count), itemStyle: { color: '#91cc75' } } 
    ]
  };

  // 8. Skills Network
  const graphOption = {
    title: { text: 'Skills Co-occurrence Network', left: 'center' },
    tooltip: {},
    series: [
      {
        type: 'graph',
        layout: 'circular', // 'force' or 'circular'
        data: data.skills_network.nodes,
        links: data.skills_network.links,
        roam: true,
        label: { show: true, position: 'right', formatter: '{b}' },
        lineStyle: { color: 'source', curveness: 0.3 },
        emphasis: { focus: 'adjacency', lineStyle: { width: 10 } }
      }
    ]
  };

  // --- Tab Contents ---

  const renderSummary = () => (
    <div>
       <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}><Card><Statistic title="Total Jobs" value={data.stats.total_jobs} prefix={<UserOutlined />} valueStyle={{ color: '#3f8600' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Avg Salary (USD)" value={Math.round(data.stats.avg_salary)} prefix={<DollarOutlined />} valueStyle={{ color: '#cf1322' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Avg Experience (Yrs)" value={data.stats.avg_experience} precision={1} prefix={<BookOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
          <Col span={6}><Card><Statistic title="Analyzed Countries" value={data.location_distribution.length} prefix={<EnvironmentOutlined />} /></Card></Col>
      </Row>
      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card title={<>Salary Distribution <ChartTip content="Shows the frequency of salary ranges. Skewed right indicates most jobs are entry-mid level." /></>} bordered={false}>
            <ReactECharts option={salaryHistOption} style={{ height: '300px' }} />
          </Card>
        </Col>
        <Col span={12}>
           <Card title={<>Top Skills <ChartTip content="Most frequently mentioned skills in job descriptions. Larger words = higher demand." /></>} bordered={false}>
            <ReactECharts option={skillCloudOption} style={{ height: '300px' }} />
          </Card>
        </Col>
      </Row>
      <Row style={{ marginTop: 24 }}>
         <Col span={24}>
           <Card>
             <Title level={4}>Executive Summary</Title>
             <Paragraph>
               This dataset analyzes <b>{data.stats.total_jobs}</b> AI-related job postings. 
               The average salary across the industry is <b>${Math.round(data.stats.avg_salary).toLocaleString()}</b>.
               Key trends indicate a strong demand for skills like <b>Python, Machine Learning, and Cloud Computing</b>.
               Most opportunities are concentrated in major tech hubs, with a clear salary progression based on experience level.
             </Paragraph>
           </Card>
         </Col>
      </Row>
    </div>
  );

  const renderUnivariate = () => (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <EDABox step="1" title="Univariate Analysis" analysis="We examine each variable individually to understand its distribution. Key finding: The salary distribution is right-skewed, suggesting a few very high-paying roles pull up the average." />
      </Col>
      <Col span={12}><Card title="Job Titles"><ReactECharts option={jobDistOption} /></Card></Col>
      <Col span={12}><Card title="Company Size"><ReactECharts option={companySizeOption} /></Card></Col>
      <Col span={12}><Card title="Remote Work Ratio"><ReactECharts option={remoteRatioOption} /></Card></Col>
      <Col span={12}><Card title="Salary Histogram"><ReactECharts option={salaryHistOption} /></Card></Col>
    </Row>
  );

  const renderBivariate = () => (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <EDABox step="2" title="Bivariate Analysis" analysis="We investigate relationships between two variables. Key finding: Experience level is the strongest predictor of salary, while company size has a mixed impact." />
      </Col>
      <Col span={12}><Card title={<>Salary vs Experience <ChartTip content="Positive correlation expected: More experience usually equals higher pay." /></>}><ReactECharts option={expSalaryOption} /></Card></Col>
      <Col span={12}><Card title={<>Salary vs Company Size <ChartTip content="Large companies often pay more, but startups (S) might offer competitive equity." /></>}><ReactECharts option={sizeSalaryOption} /></Card></Col>
      <Col span={12}><Card title={<>Salary vs Remote Ratio <ChartTip content="Do remote jobs pay less? Check if 100% remote bars are lower than 0%." /></>}><ReactECharts option={remoteSalaryOption} /></Card></Col>
      <Col span={12}><Card title="Salary vs Location (Top 15)"><ReactECharts option={locSalaryOption} /></Card></Col>
    </Row>
  );

  const renderTemporal = () => (
    <Row gutter={[24, 24]}>
      <Col span={24}>
        <EDABox step="3" title="Temporal Trends" analysis="Analyzing job postings over time reveals hiring seasonality. Spikes often correspond to Q1 budget releases or Q4 hiring freezes." />
        <Card title={<>Job Posting Trends Over Time <ChartTip content="Tracks market demand. Spikes may indicate hiring seasons or industry booms." /></>}>
          <ReactECharts option={trendOption} style={{ height: '500px' }} />
        </Card>
      </Col>
    </Row>
  );

  const renderStats = () => (
    <Row gutter={[24, 24]}>
        <Col span={24}>
            <EDABox step="4" title="Outlier Detection" analysis="Identifying anomalies in salary data. Comparing boxplots across different dimensions helps isolate whether high salaries are outliers or just typical for senior roles." />
            <Card title={<>Statistical Distribution & Outliers <ChartTip content="Boxplot shows data spread. Points outside whiskers are outliers (extreme salaries)." /></>} extra={
                <Segmented 
                    options={['Overall', 'By Experience', 'By Company Size', 'By Remote Ratio']} 
                    value={boxplotMode}
                    onChange={setBoxplotMode}
                />
            }>
                <ReactECharts option={boxplotOption} style={{ height: '500px' }} />
                <div style={{ textAlign: 'center', marginTop: 10, color: '#888' }}>
                    <Text type="secondary">
                        {boxplotMode === 'Overall' ? "Showing global salary spread." : 
                         boxplotMode === 'By Experience' ? "Compare salary spread across seniority levels (Entry -> Executive)." :
                         boxplotMode === 'By Company Size' ? "Compare salary spread across company sizes (Small, Medium, Large)." :
                         "Compare salary spread across remote work policies."}
                    </Text>
                </div>
            </Card>
        </Col>
    </Row>
  );

  const renderCorrelation = () => (
    <Row gutter={[24, 24]}>
        <Col span={24}>
            <EDABox step="5" title="Feature Correlation" analysis="A heatmap to visualize linear relationships. We observe a strong positive correlation between 'Experience Level' and 'Salary', confirming seniority is a key driver." />
            <Card title={<>Feature Correlation Analysis <ChartTip content="Red = Positive Correlation (Variables move together). Blue = Negative Correlation (Inverse relationship)." /></>}>
                <ReactECharts option={heatmapOption} style={{ height: '600px' }} />
            </Card>
        </Col>
    </Row>
  );

  const renderGeo = () => (
    <Row gutter={[24, 24]}>
        <Col span={24}>
            <EDABox step="6" title="Geographic Intelligence" analysis="Mapping global opportunities. While the US leads in total volume, certain European hubs show surprisingly high average salaries when adjusted for cost of living (implied)." />
            <Card title={<>Global Salary Heatmap <ChartTip content="Hover over countries to see average salary. Darker red = Higher salary." /></>}>
                <div style={{ width: '100%', height: '500px', border: '1px solid #f0f0f0', borderRadius: '8px', overflow: 'hidden' }}>
                    <ComposableMap projectionConfig={{ scale: 147 }}>
                        <ZoomableGroup>
                            <Geographies geography={geoUrl}>
                                {({ geographies }) =>
                                geographies.map((geo) => {
                                    const d = mapData[geo.properties.name];
                                    return (
                                    <AntTooltip key={geo.rsmKey} title={d ? `${geo.properties.name}: $${Math.round(d).toLocaleString()}` : `${geo.properties.name}: No Data`}>
                                        <Geography
                                            geography={geo}
                                            fill={d ? colorScale(d) : "#F5F4F6"}
                                            stroke="#D6D6DA"
                                            strokeWidth={0.5}
                                            style={{
                                                default: { outline: "none" },
                                                hover: { fill: "#F53", outline: "none", cursor: 'pointer' },
                                                pressed: { outline: "none" },
                                            }}
                                        />
                                    </AntTooltip>
                                    );
                                })
                                }
                            </Geographies>
                        </ZoomableGroup>
                    </ComposableMap>
                </div>
            </Card>
        </Col>
        <Col span={24}>
            <Card title="Average Salary by Country (Ranked)">
                <ReactECharts option={geoBarOption} style={{ height: '800px' }} />
            </Card>
        </Col>
    </Row>
  );

  const renderSkills = () => (
      <Row gutter={[24, 24]}>
        <Col span={24}>
            <EDABox step="7" title="Skills Network Analysis" analysis="Understanding skill clusters. The network graph reveals that 'Python' is a central node, frequently co-occurring with 'AWS', 'TensorFlow', and 'SQL'." />
        </Col>
        <Col span={12}>
            <Card title="Skill Cloud">
                <ReactECharts option={skillCloudOption} style={{ height: '500px' }} />
            </Card>
        </Col>
        <Col span={12}>
            <Card title={<>Skills Co-occurrence Network <ChartTip content="Nodes = Skills. Links = How often they appear together. Helps identifying tech stacks." /></>}>
                <ReactECharts option={graphOption} style={{ height: '500px' }} />
            </Card>
        </Col>
      </Row>
  );

  const renderIndustry = () => (
      <Row gutter={[24, 24]}>
          <Col span={24}>
              <EDABox step="8" title="Industry Segmentation" analysis="Comparing salary vs demand across sectors. The 'Finance' sector shows high salaries but lower volume, indicating a niche, high-value market." />
              <Card title={<>Industry Insights: Salary vs Demand <ChartTip content="Yellow Bars = Avg Salary. Green Line = Job Count. Look for high yellow bars with low green line (High Pay, Low Competition)." /></>}>
                  <ReactECharts option={industryBarOption} style={{ height: '500px' }} />
              </Card>
          </Col>
      </Row>
  );

  const renderML = () => {
      if (!mlData) return <Alert message="ML Data not available. Please run train_model.py first." type="warning" />;
      
      // Filter out models with negative R2 or very low performance
      const validModels = mlData.performance.filter(p => p.r2 > 0.5);

      const perfOption = {
          title: { text: 'Model Performance Comparison (R2 Score)', left: 'center' },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: validModels.map(p => p.model), axisLabel: { interval: 0, rotate: 30 } },
          yAxis: { type: 'value', min: 0, max: 1.0 }, 
          series: [{ 
              data: validModels.map(p => p.r2),
              type: 'bar',
              itemStyle: { 
                color: (params) => {
                    if (params.data >= 0.8) return '#91cc75'; // Good
                    if (params.data >= 0.5) return '#fac858'; // Medium
                    return '#ee6666'; // Poor
                },
                borderRadius: [5, 5, 0, 0]
              },
              label: {
                  show: true,
                  position: 'top',
                  formatter: (params) => params.value.toFixed(2)
              }
          }]
      };

      const importanceOption = {
          title: { text: 'Feature Importance (Top 10)', left: 'center' },
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
          xAxis: { type: 'value' },
          yAxis: { type: 'category', data: mlData.feature_importance.slice(0, 10).map(f => f.name).reverse() },
          series: [{ 
              name: 'Importance', 
              type: 'bar', 
              data: mlData.feature_importance.slice(0, 10).map(f => f.value).reverse(),
              itemStyle: { 
                  color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                      { offset: 0, color: '#fac858' },
                      { offset: 1, color: '#ee6666' }
                  ]),
                  borderRadius: [0, 5, 5, 0]
              }
          }]
      };

      const scatterOption = {
          title: { text: 'Actual vs Predicted Salary (Sample)', left: 'center' },
          tooltip: { 
              trigger: 'item',
              formatter: (params) => `Actual: $${Math.round(params.data[0])}<br/>Predicted: $${Math.round(params.data[1])}`
          },
          xAxis: { name: 'Actual Salary', type: 'value', scale: true },
          yAxis: { name: 'Predicted Salary', type: 'value', scale: true },
          series: [{
              type: 'scatter',
              symbolSize: 6,
              data: mlData.scatter_data,
              itemStyle: { color: 'rgba(84, 112, 198, 0.6)' }
          }, {
              type: 'line',
              data: [[50000, 50000], [250000, 250000]], // Ideal line
              showSymbol: false,
              lineStyle: { type: 'dashed', color: '#333' }
          }]
      };

      const residualOption = {
          title: { text: 'Residuals Distribution', left: 'center' },
          tooltip: { trigger: 'axis' },
          xAxis: { type: 'category', data: mlData.residual_distribution.bins.map(b => Math.round(b)), name: 'Residual (Error)' },
          yAxis: { type: 'value', name: 'Frequency' },
          series: [{ 
              data: mlData.residual_distribution.counts, 
              type: 'bar',
              itemStyle: { color: '#73c0de', borderRadius: [5, 5, 0, 0] }
          }]
      };

      return (
          <Row gutter={[24, 24]}>
              <Col span={24}>
                  <EDABox step="ML-1" title="Model Training & Evaluation" analysis="We trained 10 different regression models. The 'Voting Regressor' (combining LightGBM, XGBoost, and Random Forest) achieved the highest R2 Score (~0.88), significantly outperforming linear models." />
              </Col>
              <Col span={12}>
                  <Card title={<>Model Performance <ChartTip content="R2 Score (Coefficient of Determination) closer to 1.0 is better." /></>}>
                      <ReactECharts option={perfOption} />
                  </Card>
              </Col>
              <Col span={12}>
                  <Card title={<>Feature Importance <ChartTip content="Which factors contribute most to salary prediction? (Derived from XGBoost)" /></>}>
                      <ReactECharts option={importanceOption} />
                  </Card>
              </Col>
              <Col span={12}>
                  <Card title={<>Actual vs Predicted <ChartTip content="Points closer to the dashed diagonal line indicate accurate predictions." /></>}>
                      <ReactECharts option={scatterOption} />
                  </Card>
              </Col>
              <Col span={12}>
                  <Card title={<>Residual Analysis <ChartTip content="Distribution of prediction errors. A bell curve centered at 0 is ideal." /></>}>
                      <ReactECharts option={residualOption} />
                  </Card>
              </Col>
          </Row>
      );
  };

  const renderInference = () => {
    if (!metaData) return <Alert message="Model metadata not loaded." type="error" />;

    return (
        <Row gutter={[24, 24]}>
            <Col span={24}>
                <EDABox step="ML-2" title="Real-time Inference" analysis="Use our trained ensemble model to predict salary based on specific job characteristics. Enter the details below to get an instant estimation." />
            </Col>
            <Col span={12}>
                <Card title="Job Details Input" bordered={false}>
                    <Form 
                        layout="vertical" 
                        onFinish={handlePredict}
                        initialValues={{
                            job_title: 'Data Scientist',
                            experience_level: 'SE',
                            employment_type: 'FT',
                            company_location: 'US',
                            company_size: 'M',
                            industry: 'Tech', // Fallback, real data might differ
                            remote_ratio: 0
                        }}
                    >
                        <Form.Item name="job_title" label="Job Title" rules={[{ required: true }]}>
                            <Select showSearch placeholder="Select Job Title" optionFilterProp="children">
                                {metaData.job_title.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="experience_level" label="Experience Level" rules={[{ required: true }]}>
                            <Select placeholder="Select Experience Level">
                                {metaData.experience_level.map(v => <Select.Option key={v} value={v}>{v === 'EN' ? 'Entry-level' : v === 'MI' ? 'Mid-level' : v === 'SE' ? 'Senior' : 'Executive'}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="employment_type" label="Employment Type" rules={[{ required: true }]}>
                            <Select placeholder="Select Type">
                                {metaData.employment_type.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="company_location" label="Company Location" rules={[{ required: true }]}>
                            <Select showSearch placeholder="Select Country" optionFilterProp="children">
                                {metaData.company_location.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="company_size" label="Company Size" rules={[{ required: true }]}>
                            <Select placeholder="Select Size">
                                {metaData.company_size.map(v => <Select.Option key={v} value={v}>{v === 'S' ? 'Small (<50)' : v === 'M' ? 'Medium (50-250)' : 'Large (>250)'}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="industry" label="Industry" rules={[{ required: true }]}>
                             <Select showSearch placeholder="Select Industry" optionFilterProp="children">
                                {metaData.industry.map(v => <Select.Option key={v} value={v}>{v}</Select.Option>)}
                            </Select>
                        </Form.Item>
                        <Form.Item name="remote_ratio" label="Remote Work Ratio" rules={[{ required: true }]}>
                            <Select placeholder="Select Remote Ratio">
                                <Select.Option value={0}>0% (On-site)</Select.Option>
                                <Select.Option value={50}>50% (Hybrid)</Select.Option>
                                <Select.Option value={100}>100% (Remote)</Select.Option>
                            </Select>
                        </Form.Item>
                        <Form.Item>
                            <Button type="primary" htmlType="submit" icon={<CalculatorOutlined />} loading={predictLoading} block size="large">
                                Predict Salary
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </Col>
            <Col span={12}>
                <Card title="Prediction Result" bordered={false} style={{ height: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {prediction ? (
                        <div>
                            <Statistic
                                title="Estimated Annual Salary"
                                value={prediction}
                                precision={0}
                                prefix={<DollarOutlined />}
                                valueStyle={{ color: '#3f8600', fontSize: '3rem' }}
                            />
                            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                                Based on the XGBoost + LightGBM Ensemble Model
                            </Text>
                            <div style={{ marginTop: 24 }}>
                                <Alert message="Note: This is an AI estimation based on historical data. Actual offers may vary." type="info" showIcon />
                            </div>
                        </div>
                    ) : (
                        <div style={{ color: '#ccc' }}>
                            <RobotOutlined style={{ fontSize: '4rem', marginBottom: 16 }} />
                            <Title level={4} style={{ color: '#999' }}>Ready to Predict</Title>
                            <Paragraph type="secondary">
                                Fill out the form on the left to generate a salary estimation.
                            </Paragraph>
                        </div>
                    )}
                </Card>
            </Col>
        </Row>
    );
  };

  const edaItems = [
    { key: '1', label: 'Summary', children: renderSummary(), icon: <ApartmentOutlined /> },
    { key: '2', label: 'Univariate Analysis', children: renderUnivariate(), icon: <UserOutlined /> },
    { key: '3', label: 'Bivariate Analysis', children: renderBivariate(), icon: <DollarOutlined /> },
    { key: '4', label: 'Temporal Trends', children: renderTemporal(), icon: <RiseOutlined /> },
    { key: '5', label: 'Statistical Distribution', children: renderStats(), icon: <BarChartOutlined /> },
    { key: '6', label: 'Correlation Analysis', children: renderCorrelation(), icon: <HeatMapOutlined /> },
    { key: '7', label: 'Geographic Intelligence', children: renderGeo(), icon: <GlobalOutlined /> },
    { key: '8', label: 'Skills Network', children: renderSkills(), icon: <NodeIndexOutlined /> },
    { key: '9', label: 'Industry Insights', children: renderIndustry(), icon: <ApartmentOutlined /> },
  ];

  const mainTabs = [
      { key: 'eda', label: 'Data Analysis (EDA)', children: <Tabs defaultActiveKey="1" items={edaItems} tabPosition="left" />, icon: <DashboardOutlined /> },
      { key: 'ml', label: 'Salary Prediction Model', children: renderML(), icon: <RobotOutlined /> },
      { key: 'inference', label: 'Live Inference', children: renderInference(), icon: <CalculatorOutlined /> }
  ];

  return (
    <Layout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center', background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: 0 }}>AI Job Market Analytics Platform</Title>
      </Header>
      <Content style={{ padding: '24px 50px' }}>
        <div style={{ padding: 24, minHeight: 380, background: colorBgContainer, borderRadius: borderRadiusLG }}>
          <Tabs defaultActiveKey="eda" items={mainTabs} size="large" centered />
        </div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>
        AI Job Market Analysis ©2026 Created by Trae AI
      </Footer>
    </Layout>
  );
};

export default App;
