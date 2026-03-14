-- Skill Gap Analysis Dashboard
-- Tables: aicp_skill_demand, aicp_skill_gap, aicp_skill_gap_cache

CREATE TABLE IF NOT EXISTS aicp_skill_demand (
  id INT AUTO_INCREMENT PRIMARY KEY,
  skill_name VARCHAR(255) NOT NULL,
  demand_count INT DEFAULT 0,
  supply_count INT DEFAULT 0,
  industry_sector VARCHAR(100) DEFAULT NULL,
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_skill_sector (skill_name, industry_sector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aicp_skill_gap (
  id INT AUTO_INCREMENT PRIMARY KEY,
  skill_name VARCHAR(255) NOT NULL,
  demand_count INT DEFAULT 0,
  supply_count INT DEFAULT 0,
  gap_score DECIMAL(6,2) DEFAULT 0,
  priority ENUM('critical','high','medium','low') DEFAULT 'low',
  department VARCHAR(255) DEFAULT NULL,
  program VARCHAR(255) DEFAULT NULL,
  graduation_year INT DEFAULT NULL,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_skill_dept (skill_name, department, program, graduation_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS aicp_skill_gap_cache (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cache_key VARCHAR(255) NOT NULL UNIQUE,
  cache_value LONGTEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Indexes
CREATE INDEX idx_skill_demand_name ON aicp_skill_demand(skill_name);
CREATE INDEX idx_skill_demand_computed ON aicp_skill_demand(computed_at);
CREATE INDEX idx_skill_gap_priority ON aicp_skill_gap(priority);
CREATE INDEX idx_skill_gap_score ON aicp_skill_gap(gap_score DESC);
CREATE INDEX idx_skill_gap_dept ON aicp_skill_gap(department);
CREATE INDEX idx_skill_gap_computed ON aicp_skill_gap(computed_at);
CREATE INDEX idx_skill_gap_cache_key ON aicp_skill_gap_cache(cache_key);
CREATE INDEX idx_skill_gap_cache_expires ON aicp_skill_gap_cache(expires_at);
