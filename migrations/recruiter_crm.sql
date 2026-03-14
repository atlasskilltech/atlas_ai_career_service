-- Recruiter CRM Module
-- Tables: aicp_recruiters, aicp_recruiter_interactions

CREATE TABLE IF NOT EXISTS aicp_recruiters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  logo VARCHAR(500) DEFAULT NULL,
  website VARCHAR(500) DEFAULT NULL,
  industry VARCHAR(100) DEFAULT NULL,
  company_size ENUM('startup','small','medium','large','enterprise') DEFAULT NULL,
  tier ENUM('platinum','gold','silver','new') DEFAULT 'new',
  tier_score DECIMAL(10,2) DEFAULT 0,
  mou_status ENUM('none','pending','active','expired') DEFAULT 'none',
  mou_expiry DATE DEFAULT NULL,
  contact_name VARCHAR(255) DEFAULT NULL,
  contact_role VARCHAR(100) DEFAULT NULL,
  contact_email VARCHAR(255) DEFAULT NULL,
  contact_phone VARCHAR(20) DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  last_interaction_at TIMESTAMP DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES aicp_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aicp_recruiter_interactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  recruiter_id INT NOT NULL,
  type ENUM('email','call','campus_visit','virtual','other') NOT NULL,
  interaction_date TIMESTAMP NOT NULL,
  summary TEXT NOT NULL,
  follow_up_date DATE DEFAULT NULL,
  follow_up_done TINYINT(1) DEFAULT 0,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recruiter_id) REFERENCES aicp_recruiters(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES aicp_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX idx_recruiters_tier ON aicp_recruiters(tier);
CREATE INDEX idx_recruiters_industry ON aicp_recruiters(industry);
CREATE INDEX idx_recruiters_mou ON aicp_recruiters(mou_status);
CREATE INDEX idx_interactions_recruiter ON aicp_recruiter_interactions(recruiter_id);
CREATE INDEX idx_interactions_followup ON aicp_recruiter_interactions(follow_up_date, follow_up_done);
