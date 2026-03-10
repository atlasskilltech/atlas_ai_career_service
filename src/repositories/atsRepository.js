const pool = require('../config/database');

class AtsRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM ats_analyses WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM ats_analyses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO ats_analyses (user_id, resume_id, job_description, ats_score, keyword_matches, missing_keywords, formatting_issues, suggestions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.resumeId || null, data.jobDescription || '', data.atsScore || 0, JSON.stringify(data.keywordMatches || []), JSON.stringify(data.missingKeywords || []), JSON.stringify(data.formattingIssues || []), JSON.stringify(data.suggestions || [])]
    );
    return { id: result.insertId, ...data };
  }
}

module.exports = new AtsRepository();
