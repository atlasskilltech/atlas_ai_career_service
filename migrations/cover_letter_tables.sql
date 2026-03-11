-- ============================================
-- AI Cover Letter Generator - Database Setup
-- Run this SQL directly on your MySQL database
-- ============================================

-- Add new columns to existing aicp_cover_letters table
ALTER TABLE aicp_cover_letters
  ADD COLUMN IF NOT EXISTS resume_id INT AFTER user_id,
  ADD COLUMN IF NOT EXISTS tone VARCHAR(50) DEFAULT 'professional' AFTER content;

-- Create cover letter versions table
CREATE TABLE IF NOT EXISTS aicp_cover_letter_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cover_letter_id INT NOT NULL,
  version_number INT DEFAULT 1,
  content_snapshot TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cover_letter_id) REFERENCES aicp_cover_letters(id) ON DELETE CASCADE
);

-- Create cover letter jobs table
CREATE TABLE IF NOT EXISTS aicp_cover_letter_jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cover_letter_id INT NOT NULL,
  job_description TEXT,
  company_name VARCHAR(255),
  job_role VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (cover_letter_id) REFERENCES aicp_cover_letters(id) ON DELETE CASCADE
);
