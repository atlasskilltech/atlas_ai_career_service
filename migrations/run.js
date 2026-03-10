const pool = require('../src/config/database');
require('dotenv').config();

const tables = [
  `CREATE TABLE IF NOT EXISTS aicp_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
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
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_resumes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) DEFAULT 'Untitled Resume',
    profile_data JSON,
    education_data JSON,
    experience_data JSON,
    projects_data JSON,
    skills_data JSON,
    achievements_data JSON,
    template VARCHAR(100) DEFAULT 'modern',
    ats_score INT DEFAULT 0,
    file_path VARCHAR(500),
    is_primary TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_cover_letters (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255),
    company_name VARCHAR(255),
    job_title VARCHAR(255),
    content TEXT,
    job_description TEXT,
    version INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_linkedin_profiles (
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
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_jobs (
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
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_job_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    due_date DATE,
    completed TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES aicp_jobs(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_contacts (
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
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_interaction_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    contact_id INT NOT NULL,
    user_id INT NOT NULL,
    interaction_type ENUM('email','call','meeting','linkedin','other') DEFAULT 'other',
    notes TEXT,
    interaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES aicp_contacts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_mock_interviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    interview_type ENUM('technical','behavioral','hr','case_study') DEFAULT 'behavioral',
    mode ENUM('text','audio','video') DEFAULT 'text',
    job_role VARCHAR(255),
    questions JSON,
    answers JSON,
    status ENUM('in_progress','completed') DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_interview_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    interview_id INT NOT NULL,
    user_id INT NOT NULL,
    confidence_score INT DEFAULT 0,
    communication_score INT DEFAULT 0,
    technical_score INT DEFAULT 0,
    star_score INT DEFAULT 0,
    overall_score INT DEFAULT 0,
    feedback_text TEXT,
    suggestions JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (interview_id) REFERENCES aicp_mock_interviews(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_skill_analyses (
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
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_documents (
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES aicp_users(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_ats_analyses (
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
  )`,
];

async function runMigrations() {
  console.log('Running migrations...');
  for (const sql of tables) {
    try {
      await pool.execute(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`  ✓ Table "${tableName}" ready`);
    } catch (err) {
      console.error('  ✗ Migration error:', err.message);
    }
  }
  console.log('Migrations complete.');
  process.exit(0);
}

runMigrations();
