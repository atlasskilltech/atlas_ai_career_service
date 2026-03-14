-- Job Management System for Admin Dashboard
-- Tables: aicp_admin_jobs, aicp_admin_job_skills, aicp_admin_job_rounds, aicp_admin_job_applications

CREATE TABLE IF NOT EXISTS aicp_admin_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  company_logo VARCHAR(500) DEFAULT NULL,
  role_title VARCHAR(255) NOT NULL,
  job_type ENUM('full_time','part_time','internship','contract','freelance') DEFAULT 'full_time',
  ctc_min DECIMAL(10,2) DEFAULT NULL,
  ctc_max DECIMAL(10,2) DEFAULT NULL,
  ctc_currency VARCHAR(10) DEFAULT 'INR',
  location VARCHAR(255) DEFAULT NULL,
  work_mode ENUM('onsite','remote','hybrid') DEFAULT 'onsite',
  description LONGTEXT DEFAULT NULL,
  cgpa_cutoff DECIMAL(3,1) DEFAULT NULL,
  eligible_programs JSON DEFAULT NULL,
  eligible_branches JSON DEFAULT NULL,
  eligible_years JSON DEFAULT NULL,
  application_deadline DATE DEFAULT NULL,
  joining_date DATE DEFAULT NULL,
  selection_notes TEXT DEFAULT NULL,
  status ENUM('draft','active','closed','on_hold') DEFAULT 'draft',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES aicp_users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS aicp_admin_job_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  is_required TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES aicp_admin_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_admin_job_rounds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  round_number INT NOT NULL DEFAULT 1,
  round_name VARCHAR(100) NOT NULL,
  round_type ENUM('aptitude','technical','hr','group_discussion','coding','other') DEFAULT 'technical',
  description TEXT DEFAULT NULL,
  duration_minutes INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES aicp_admin_jobs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_admin_job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  user_id INT NOT NULL,
  stage ENUM('applied','shortlisted','interview','offered','rejected','withdrawn') DEFAULT 'applied',
  current_round INT DEFAULT NULL,
  ats_match_score INT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES aicp_admin_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_job_user (job_id, user_id)
);

-- Indexes
CREATE INDEX idx_admin_jobs_status ON aicp_admin_jobs(status);
CREATE INDEX idx_admin_jobs_company ON aicp_admin_jobs(company_name);
CREATE INDEX idx_admin_jobs_deadline ON aicp_admin_jobs(application_deadline);
CREATE INDEX idx_admin_job_apps_stage ON aicp_admin_job_applications(stage);
CREATE INDEX idx_admin_job_apps_job ON aicp_admin_job_applications(job_id);
CREATE INDEX idx_admin_job_apps_user ON aicp_admin_job_applications(user_id);
