-- ============================================================
-- Student Management System Tables
-- ============================================================

-- Extended student profiles (linked to aicp_users)
CREATE TABLE IF NOT EXISTS aicp_student_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  student_id VARCHAR(50),
  program VARCHAR(255),
  branch VARCHAR(255),
  graduation_year INT,
  cgpa DECIMAL(4,2),
  linkedin_url VARCHAR(500),
  github_url VARCHAR(500),
  portfolio_url VARCHAR(500),
  placement_status ENUM('not_placed','in_process','placed','opted_out','higher_studies') DEFAULT 'not_placed',
  last_active DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

-- Student skills (normalized for filtering)
CREATE TABLE IF NOT EXISTS aicp_student_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  skill_type ENUM('technical','soft','tool') DEFAULT 'technical',
  proficiency ENUM('beginner','intermediate','advanced','expert') DEFAULT 'intermediate',
  added_by ENUM('student','admin') DEFAULT 'student',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_skill (user_id, skill_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sp_placement ON aicp_student_profiles(placement_status);
CREATE INDEX IF NOT EXISTS idx_sp_program ON aicp_student_profiles(program);
CREATE INDEX IF NOT EXISTS idx_sp_branch ON aicp_student_profiles(branch);
CREATE INDEX IF NOT EXISTS idx_sp_grad_year ON aicp_student_profiles(graduation_year);
CREATE INDEX IF NOT EXISTS idx_ss_skill ON aicp_student_skills(skill_name);
CREATE INDEX IF NOT EXISTS idx_ss_type ON aicp_student_skills(skill_type);
