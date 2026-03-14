-- Application Tracking Pipeline Tables
-- Run this migration to set up kanban pipeline tracking

CREATE TABLE IF NOT EXISTS aicp_application_pipeline (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  job_id INT NOT NULL,
  user_id INT NOT NULL,
  stage ENUM('applied','shortlisted','interview','offered','rejected','withdrawn') NOT NULL DEFAULT 'applied',
  sub_stage VARCHAR(100) DEFAULT NULL,
  priority ENUM('low','medium','high','urgent') DEFAULT 'medium',
  assigned_to INT DEFAULT NULL,
  sort_order INT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES aicp_admin_job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES aicp_admin_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_application (application_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aicp_pipeline_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  job_id INT NOT NULL,
  user_id INT NOT NULL,
  from_stage VARCHAR(50),
  to_stage VARCHAR(50) NOT NULL,
  changed_by INT DEFAULT NULL,
  change_reason TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES aicp_admin_job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES aicp_admin_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Index for fast lookups
CREATE INDEX idx_pipeline_job_stage ON aicp_application_pipeline(job_id, stage);
CREATE INDEX idx_pipeline_user ON aicp_application_pipeline(user_id);
CREATE INDEX idx_audit_application ON aicp_pipeline_audit(application_id);
CREATE INDEX idx_audit_job ON aicp_pipeline_audit(job_id);
