-- Placement Analytics Module
-- Cached placement statistics for fast dashboard rendering

CREATE TABLE IF NOT EXISTS aicp_placement_stats (
  id INT AUTO_INCREMENT PRIMARY KEY,
  academic_year VARCHAR(20) NOT NULL,
  program VARCHAR(255) DEFAULT NULL,
  branch VARCHAR(255) DEFAULT NULL,
  total_eligible INT DEFAULT 0,
  total_placed INT DEFAULT 0,
  placement_pct DECIMAL(5,2) DEFAULT 0,
  avg_ctc DECIMAL(12,2) DEFAULT 0,
  median_ctc DECIMAL(12,2) DEFAULT 0,
  highest_ctc DECIMAL(12,2) DEFAULT 0,
  unplaced_count INT DEFAULT 0,
  computed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_year_prog_branch (academic_year, program, branch)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_placement_stats_year ON aicp_placement_stats(academic_year);
CREATE INDEX idx_placement_stats_program ON aicp_placement_stats(program);
CREATE INDEX idx_placement_stats_branch ON aicp_placement_stats(branch);
