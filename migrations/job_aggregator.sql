-- ============================================================
-- Job Aggregator System - Database Schema
-- ============================================================

-- Aggregated job listings from multiple sources
CREATE TABLE IF NOT EXISTS aicp_aggregated_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  external_id VARCHAR(255),
  title VARCHAR(500) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  salary_min INT,
  salary_max INT,
  salary_currency VARCHAR(10) DEFAULT 'INR',
  experience_min INT DEFAULT 0,
  experience_max INT,
  description TEXT,
  skills JSON,
  category VARCHAR(100),
  job_type ENUM('full_time','part_time','internship','contract','freelance') DEFAULT 'full_time',
  work_mode ENUM('onsite','remote','hybrid') DEFAULT 'onsite',
  source ENUM('linkedin','naukri','company','api','manual') NOT NULL,
  source_url VARCHAR(1000),
  apply_url VARCHAR(1000),
  company_logo VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  is_verified TINYINT(1) DEFAULT 0,
  posted_date DATETIME,
  expires_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_source_job (source, external_id)
);

-- Companies posting jobs directly
CREATE TABLE IF NOT EXISTS aicp_job_companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  logo VARCHAR(500),
  website VARCHAR(500),
  industry VARCHAR(100),
  description TEXT,
  is_verified TINYINT(1) DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES aicp_users(id) ON DELETE SET NULL
);

-- Job applications through the aggregator
CREATE TABLE IF NOT EXISTS aicp_job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  job_id INT NOT NULL,
  status ENUM('applied','reviewed','shortlisted','interview','offered','rejected') DEFAULT 'applied',
  resume_id INT,
  cover_letter TEXT,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES aicp_aggregated_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (resume_id) REFERENCES aicp_resumes(id) ON DELETE SET NULL,
  UNIQUE KEY unique_application (user_id, job_id)
);

-- Saved/bookmarked jobs
CREATE TABLE IF NOT EXISTS aicp_saved_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  job_id INT NOT NULL,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES aicp_aggregated_jobs(id) ON DELETE CASCADE,
  UNIQUE KEY unique_saved (user_id, job_id)
);

-- Job source scraper run logs
CREATE TABLE IF NOT EXISTS aicp_scraper_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  status ENUM('running','completed','failed') DEFAULT 'running',
  jobs_found INT DEFAULT 0,
  jobs_added INT DEFAULT 0,
  jobs_updated INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

-- Indexes for search performance
CREATE INDEX idx_agg_jobs_title ON aicp_aggregated_jobs(title);
CREATE INDEX idx_agg_jobs_company ON aicp_aggregated_jobs(company);
CREATE INDEX idx_agg_jobs_location ON aicp_aggregated_jobs(location);
CREATE INDEX idx_agg_jobs_category ON aicp_aggregated_jobs(category);
CREATE INDEX idx_agg_jobs_source ON aicp_aggregated_jobs(source);
CREATE INDEX idx_agg_jobs_active ON aicp_aggregated_jobs(is_active);
CREATE INDEX idx_agg_jobs_posted ON aicp_aggregated_jobs(posted_date);
CREATE INDEX idx_job_apps_user ON aicp_job_applications(user_id);
CREATE INDEX idx_job_apps_status ON aicp_job_applications(status);
