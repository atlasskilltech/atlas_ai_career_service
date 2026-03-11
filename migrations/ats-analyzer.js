const pool = require('../src/config/database');
require('dotenv').config();

const tables = [
  `CREATE TABLE IF NOT EXISTS aicp_resume_analysis (
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
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_resume_keywords (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    keyword VARCHAR(255) NOT NULL,
    is_present TINYINT(1) DEFAULT 0,
    category VARCHAR(100) DEFAULT 'general',
    FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_resume_missing_skills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    skill_name VARCHAR(255) NOT NULL,
    importance ENUM('critical','recommended','nice_to_have') DEFAULT 'recommended',
    FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_resume_format_issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    issue_type VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    severity ENUM('high','medium','low') DEFAULT 'medium',
    FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
  )`,

  `CREATE TABLE IF NOT EXISTS aicp_resume_suggestions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    analysis_id INT NOT NULL,
    suggestion_text TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'general',
    priority INT DEFAULT 0,
    FOREIGN KEY (analysis_id) REFERENCES aicp_resume_analysis(id) ON DELETE CASCADE
  )`,
];

async function runMigration() {
  console.log('Running ATS Analyzer migration...');
  for (const sql of tables) {
    try {
      await pool.execute(sql);
      const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
      console.log(`  ✓ Table "${tableName}" ready`);
    } catch (err) {
      console.error('  ✗ Migration error:', err.message);
    }
  }
  console.log('ATS Analyzer migration complete.');
  process.exit(0);
}

runMigration();
