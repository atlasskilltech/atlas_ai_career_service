-- ============================================================
-- Atlas AI Career Service - Complete Database Schema
-- Single file containing ALL tables and migrations
-- Run: mysql -u root -p atlas_career < migrations/schema.sql
-- ============================================================

-- =====================
-- 1. USERS
-- =====================
CREATE TABLE IF NOT EXISTS aicp_users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  role ENUM('student','placement_admin','super_admin') DEFAULT 'student',
  avatar VARCHAR(500),
  department VARCHAR(255),
  year_of_study INT,
  phone VARCHAR(20),
  email_verified TINYINT(1) DEFAULT 0,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =====================
-- 2. RESUMES
-- =====================
CREATE TABLE IF NOT EXISTS aicp_resumes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) DEFAULT 'Untitled Resume',
  profile_data JSON,
  education_data JSON,
  experience_data JSON,
  projects_data JSON,
  skills_data JSON,
  achievements_data JSON,
  certifications_data JSON,
  languages_data JSON,
  interests_data JSON,
  section_order JSON,
  theme_color VARCHAR(20) DEFAULT '#0a1a4a',
  template VARCHAR(100) DEFAULT 'modern',
  ats_score INT DEFAULT 0,
  file_path VARCHAR(500),
  is_primary TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_resume_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  resume_id INT NOT NULL,
  version_number INT DEFAULT 1,
  snapshot_json JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (resume_id) REFERENCES aicp_resumes(id) ON DELETE CASCADE
);

-- =====================
-- 3. COVER LETTERS
-- =====================
CREATE TABLE IF NOT EXISTS aicp_cover_letters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  resume_id INT,
  title VARCHAR(255),
  company_name VARCHAR(255),
  job_title VARCHAR(255),
  content TEXT,
  tone VARCHAR(50) DEFAULT 'professional',
  job_description TEXT,
  version INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_cover_letter_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cover_letter_id INT NOT NULL,
  version_number INT DEFAULT 1,
  content_snapshot TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cover_letter_id) REFERENCES aicp_cover_letters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_cover_letter_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cover_letter_id INT NOT NULL,
  job_description TEXT,
  company_name VARCHAR(255),
  job_role VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cover_letter_id) REFERENCES aicp_cover_letters(id) ON DELETE CASCADE
);

-- =====================
-- 4. LINKEDIN PROFILES
-- =====================
CREATE TABLE IF NOT EXISTS aicp_linkedin_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  original_headline VARCHAR(500),
  optimized_headline VARCHAR(500),
  original_about TEXT,
  optimized_about TEXT,
  skill_recommendations JSON,
  keyword_suggestions JSON,
  overall_score INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

-- =====================
-- 5. JOB TRACKER
-- =====================
CREATE TABLE IF NOT EXISTS aicp_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  company VARCHAR(255) NOT NULL,
  position VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  url VARCHAR(500),
  salary_range VARCHAR(100),
  description TEXT,
  status ENUM('saved','applied','interview','offer','rejected') DEFAULT 'saved',
  applied_date DATE,
  notes TEXT,
  match_score INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_job_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  due_date DATE,
  completed TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES aicp_jobs(id) ON DELETE CASCADE
);

-- =====================
-- 6. NETWORKING / CONTACTS
-- =====================
CREATE TABLE IF NOT EXISTS aicp_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  company VARCHAR(255),
  position VARCHAR(255),
  linkedin_url VARCHAR(500),
  contact_type ENUM('recruiter','hiring_manager','referral','mentor','other') DEFAULT 'other',
  notes TEXT,
  last_contacted DATE,
  follow_up_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_interaction_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NOT NULL,
  user_id INT NOT NULL,
  interaction_type ENUM('email','call','meeting','linkedin','other') DEFAULT 'other',
  notes TEXT,
  interaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES aicp_contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

-- =====================
-- 7. MOCK INTERVIEWS
-- =====================
CREATE TABLE IF NOT EXISTS aicp_interviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  job_role VARCHAR(255) NOT NULL DEFAULT 'Software Engineer',
  company VARCHAR(255),
  interview_type ENUM('technical','behavioral','hr','case_study') DEFAULT 'behavioral',
  difficulty ENUM('easy','medium','hard') DEFAULT 'medium',
  status ENUM('setup','in_progress','completed') DEFAULT 'setup',
  total_questions INT DEFAULT 0,
  total_answered INT DEFAULT 0,
  duration_seconds INT DEFAULT 0,
  started_at DATETIME,
  completed_at DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_interview_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  question TEXT NOT NULL,
  question_order INT NOT NULL,
  is_follow_up TINYINT(1) DEFAULT 0,
  parent_question_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (interview_id) REFERENCES aicp_interviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_interview_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  question_id INT NOT NULL,
  interview_id INT NOT NULL,
  answer_text TEXT,
  answer_duration_seconds INT DEFAULT 0,
  filler_words_count INT DEFAULT 0,
  word_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES aicp_interview_questions(id) ON DELETE CASCADE,
  FOREIGN KEY (interview_id) REFERENCES aicp_interviews(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_interview_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  user_id INT NOT NULL,
  technical_score INT DEFAULT 0,
  communication_score INT DEFAULT 0,
  confidence_score INT DEFAULT 0,
  problem_solving_score INT DEFAULT 0,
  overall_score INT DEFAULT 0,
  strengths JSON,
  weaknesses JSON,
  suggestions JSON,
  detailed_feedback TEXT,
  question_feedback JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (interview_id) REFERENCES aicp_interviews(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

-- =====================
-- 8. SKILL GAP ANALYZER
-- =====================
CREATE TABLE IF NOT EXISTS aicp_skill_analyses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  target_role VARCHAR(255),
  current_skills JSON,
  missing_skills JSON,
  learning_roadmap JSON,
  recommended_courses JSON,
  match_percentage INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

-- =====================
-- 9. DOCUMENT HUB
-- =====================
CREATE TABLE IF NOT EXISTS aicp_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  doc_type ENUM('resume','certificate','project','portfolio','other') DEFAULT 'other',
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255),
  file_size INT,
  mime_type VARCHAR(100),
  version INT DEFAULT 1,
  notes TEXT,
  s3_key VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
);

-- =====================
-- 10. ATS ANALYZER (Legacy)
-- =====================
CREATE TABLE IF NOT EXISTS aicp_ats_analyses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  resume_id INT,
  job_description TEXT,
  ats_score INT DEFAULT 0,
  keyword_matches JSON,
  missing_keywords JSON,
  formatting_issues JSON,
  suggestions JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  FOREIGN KEY (resume_id) REFERENCES aicp_resumes(id) ON DELETE SET NULL
);

-- =====================
-- 11. ATS RESUME ANALYZER (Advanced)
-- =====================
CREATE TABLE IF NOT EXISTS aicp_resume_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  resume_id INT,
  job_description TEXT,
  ats_score INT DEFAULT 0,
  keyword_match_score INT DEFAULT 0,
  skills_match_score INT DEFAULT 0,
  formatting_score INT DEFAULT 0,
  content_score INT DEFAULT 0,
  experience_score INT DEFAULT 0,
  resume_text TEXT,
  parsed_resume JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  FOREIGN KEY (resume_id) REFERENCES aicp_resumes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS aicp_resume_keywords (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT NOT NULL,
  keyword VARCHAR(255) NOT NULL,
  is_present TINYINT(1) DEFAULT 0,
  category VARCHAR(100) DEFAULT 'general',
  FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_resume_missing_skills (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT NOT NULL,
  skill_name VARCHAR(255) NOT NULL,
  importance ENUM('critical','recommended','nice_to_have') DEFAULT 'recommended',
  FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_resume_format_issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT NOT NULL,
  issue_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  severity ENUM('high','medium','low') DEFAULT 'medium',
  FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS aicp_resume_suggestions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_id INT NOT NULL,
  suggestion_text TEXT NOT NULL,
  category VARCHAR(100) DEFAULT 'general',
  priority INT DEFAULT 0,
  FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
);

-- =====================
-- 12. JOB AGGREGATOR
-- =====================
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

CREATE TABLE IF NOT EXISTS aicp_saved_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  job_id INT NOT NULL,
  saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES aicp_aggregated_jobs(id) ON DELETE CASCADE,
  UNIQUE KEY unique_saved (user_id, job_id)
);

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

-- ============================================================
-- INDEXES for search performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_agg_jobs_title ON aicp_aggregated_jobs(title);
CREATE INDEX IF NOT EXISTS idx_agg_jobs_company ON aicp_aggregated_jobs(company);
CREATE INDEX IF NOT EXISTS idx_agg_jobs_location ON aicp_aggregated_jobs(location);
CREATE INDEX IF NOT EXISTS idx_agg_jobs_category ON aicp_aggregated_jobs(category);
CREATE INDEX IF NOT EXISTS idx_agg_jobs_source ON aicp_aggregated_jobs(source);
CREATE INDEX IF NOT EXISTS idx_agg_jobs_active ON aicp_aggregated_jobs(is_active);
CREATE INDEX IF NOT EXISTS idx_agg_jobs_posted ON aicp_aggregated_jobs(posted_date);
CREATE INDEX IF NOT EXISTS idx_job_apps_user ON aicp_job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_apps_status ON aicp_job_applications(status);

-- ============================================================
-- ALTER TABLE statements (for upgrading existing databases)
-- ============================================================

ALTER TABLE aicp_users
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE AFTER password,
  MODIFY COLUMN password VARCHAR(255) NULL;

ALTER TABLE aicp_resumes
  ADD COLUMN IF NOT EXISTS certifications_data JSON AFTER achievements_data,
  ADD COLUMN IF NOT EXISTS languages_data JSON AFTER certifications_data,
  ADD COLUMN IF NOT EXISTS interests_data JSON AFTER languages_data,
  ADD COLUMN IF NOT EXISTS section_order JSON AFTER interests_data,
  ADD COLUMN IF NOT EXISTS theme_color VARCHAR(20) DEFAULT '#0a1a4a' AFTER section_order;

ALTER TABLE aicp_cover_letters
  ADD COLUMN IF NOT EXISTS resume_id INT AFTER user_id,
  ADD COLUMN IF NOT EXISTS tone VARCHAR(50) DEFAULT 'professional' AFTER content;

ALTER TABLE aicp_documents
  ADD COLUMN IF NOT EXISTS s3_key VARCHAR(500) AFTER notes;
