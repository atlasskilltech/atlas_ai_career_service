-- ============================================================
-- Admin Dashboard Tables
-- ============================================================

-- Dashboard metrics cache (pre-computed KPIs)
CREATE TABLE IF NOT EXISTS aicp_dashboard_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  metric_key VARCHAR(100) NOT NULL,
  metric_value DECIMAL(15,2) DEFAULT 0,
  previous_value DECIMAL(15,2) DEFAULT 0,
  academic_year VARCHAR(20) NOT NULL DEFAULT '2025-26',
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_metric_year (metric_key, academic_year)
);

-- Activity log for live feed widgets
CREATE TABLE IF NOT EXISTS aicp_activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  activity_type ENUM('job_posted','application','interview_scheduled','offer','placement') NOT NULL,
  title VARCHAR(255) NOT NULL,
  subtitle VARCHAR(255),
  meta_json JSON,
  academic_year VARCHAR(20) NOT NULL DEFAULT '2025-26',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activity_type (activity_type),
  INDEX idx_activity_year (academic_year),
  INDEX idx_activity_created (created_at)
);
