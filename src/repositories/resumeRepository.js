const pool = require('../config/database');

class ResumeRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM resumes WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM resumes WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async findPrimary(userId) {
    const [rows] = await pool.execute('SELECT * FROM resumes WHERE user_id = ? AND is_primary = 1', [userId]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO resumes (user_id, title, profile_data, education_data, experience_data, projects_data, skills_data, achievements_data, template) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.title || 'Untitled Resume', JSON.stringify(data.profile || {}), JSON.stringify(data.education || []), JSON.stringify(data.experience || []), JSON.stringify(data.projects || []), JSON.stringify(data.skills || []), JSON.stringify(data.achievements || []), data.template || 'modern']
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
    values.push(id);
    await pool.execute(`UPDATE resumes SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM resumes WHERE id = ?', [id]);
  }

  async setPrimary(userId, resumeId) {
    await pool.execute('UPDATE resumes SET is_primary = 0 WHERE user_id = ?', [userId]);
    await pool.execute('UPDATE resumes SET is_primary = 1 WHERE id = ? AND user_id = ?', [resumeId, userId]);
  }

  async getScoreDistribution() {
    const [rows] = await pool.execute(`
      SELECT
        CASE
          WHEN ats_score >= 80 THEN 'Excellent (80-100)'
          WHEN ats_score >= 60 THEN 'Good (60-79)'
          WHEN ats_score >= 40 THEN 'Fair (40-59)'
          ELSE 'Needs Work (0-39)'
        END as range_label,
        COUNT(*) as count
      FROM resumes
      GROUP BY range_label
      ORDER BY MIN(ats_score) DESC
    `);
    return rows;
  }

  async getAverageScore() {
    const [rows] = await pool.execute('SELECT AVG(ats_score) as avg_score FROM resumes WHERE ats_score > 0');
    return Math.round(rows[0].avg_score || 0);
  }
}

module.exports = new ResumeRepository();
