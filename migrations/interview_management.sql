-- ============================================================
-- Interview Management System (Admin) — Migration
-- Separate tables from student mock-interview tables
-- ============================================================

-- Scheduled interviews managed by placement admin
CREATE TABLE IF NOT EXISTS aicp_admin_interviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  job_id INT NOT NULL,
  application_id INT DEFAULT NULL,
  student_id INT NOT NULL,
  recruiter_id INT DEFAULT NULL,

  -- Interview details
  interview_type ENUM('technical','hr','behavioral','case_study','group_discussion','aptitude','coding','panel','other') NOT NULL DEFAULT 'technical',
  round_number INT NOT NULL DEFAULT 1,
  round_name VARCHAR(255) DEFAULT NULL,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',

  -- Mode
  mode ENUM('online','onsite','phone') NOT NULL DEFAULT 'online',
  meet_link VARCHAR(1000) DEFAULT NULL,
  venue VARCHAR(500) DEFAULT NULL,

  -- Status
  status ENUM('scheduled','confirmed','in_progress','completed','cancelled','rescheduled','no_show') NOT NULL DEFAULT 'scheduled',
  cancellation_reason TEXT DEFAULT NULL,

  -- Feedback tracking
  feedback_submitted TINYINT(1) DEFAULT 0,
  feedback_token VARCHAR(100) DEFAULT NULL,
  feedback_token_expires DATETIME DEFAULT NULL,

  -- Scores (filled after feedback)
  technical_score INT DEFAULT NULL,
  communication_score INT DEFAULT NULL,
  problem_solving_score INT DEFAULT NULL,
  culture_fit_score INT DEFAULT NULL,
  overall_score INT DEFAULT NULL,
  recommendation ENUM('strongly_recommend','recommend','on_hold','reject') DEFAULT NULL,
  feedback_comments TEXT DEFAULT NULL,
  ai_feedback_summary TEXT DEFAULT NULL,

  -- Meta
  notes TEXT DEFAULT NULL,
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (job_id) REFERENCES aicp_admin_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES aicp_admin_job_applications(id) ON DELETE SET NULL,
  FOREIGN KEY (student_id) REFERENCES aicp_users(id) ON DELETE CASCADE,
  FOREIGN KEY (recruiter_id) REFERENCES aicp_recruiters(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES aicp_users(id) ON DELETE SET NULL,

  INDEX idx_interview_job (job_id),
  INDEX idx_interview_student (student_id),
  INDEX idx_interview_date (scheduled_date),
  INDEX idx_interview_status (status),
  INDEX idx_feedback_token (feedback_token)
);

-- Notification log for interview emails (confirmation, reminders, reschedule)
CREATE TABLE IF NOT EXISTS aicp_interview_notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  notification_type ENUM('confirmation','reminder_24h','reminder_1h','reschedule','cancellation','feedback_request') NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  recipient_type ENUM('student','recruiter','admin') NOT NULL DEFAULT 'student',
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('sent','failed','pending') DEFAULT 'sent',
  error_message TEXT DEFAULT NULL,

  FOREIGN KEY (interview_id) REFERENCES aicp_admin_interviews(id) ON DELETE CASCADE,
  INDEX idx_notification_interview (interview_id)
);

-- Detailed feedback criteria (individual rating items)
CREATE TABLE IF NOT EXISTS aicp_interview_feedback_criteria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  interview_id INT NOT NULL,
  criteria_name VARCHAR(100) NOT NULL,
  rating INT NOT NULL DEFAULT 0,
  comments TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (interview_id) REFERENCES aicp_admin_interviews(id) ON DELETE CASCADE,
  INDEX idx_feedback_interview (interview_id)
);
