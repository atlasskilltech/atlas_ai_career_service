const pool = require('../config/database');

class ResumeRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_resumes WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_resumes WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async findPrimary(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_resumes WHERE user_id = ? AND is_primary = 1', [userId]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_resumes (user_id, title, profile_data, education_data, experience_data, projects_data, skills_data, achievements_data, certifications_data, languages_data, interests_data, section_order, template, theme_color)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.title || 'Untitled Resume',
        JSON.stringify(data.profile || {}),
        JSON.stringify(data.education || []),
        JSON.stringify(data.experience || []),
        JSON.stringify(data.projects || []),
        JSON.stringify(data.skills || {}),
        JSON.stringify(data.achievements || []),
        JSON.stringify(data.certifications || []),
        JSON.stringify(data.languages || []),
        JSON.stringify(data.interests || []),
        JSON.stringify(data.section_order || ['profile','education','experience','projects','skills','achievements','certifications','languages','interests']),
        data.template || 'modern',
        data.theme_color || '#0a1a4a',
      ]
    );
    return { id: result.insertId, ...data };
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'id' || key === 'user_id' || key === 'created_at') continue;
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    }
    if (fields.length === 0) return;
    values.push(id);
    await pool.execute(`UPDATE aicp_resumes SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM aicp_resumes WHERE id = ?', [id]);
  }

  async setPrimary(userId, resumeId) {
    await pool.execute('UPDATE aicp_resumes SET is_primary = 0 WHERE user_id = ?', [userId]);
    await pool.execute('UPDATE aicp_resumes SET is_primary = 1 WHERE id = ? AND user_id = ?', [resumeId, userId]);
  }

  // Version history
  async saveVersion(resumeId, snapshotJson) {
    const [countRows] = await pool.execute('SELECT COUNT(*) as cnt FROM aicp_resume_versions WHERE resume_id = ?', [resumeId]);
    const versionNumber = (countRows[0]?.cnt || 0) + 1;
    const [result] = await pool.execute(
      'INSERT INTO aicp_resume_versions (resume_id, version_number, snapshot_json) VALUES (?, ?, ?)',
      [resumeId, versionNumber, JSON.stringify(snapshotJson)]
    );
    return { id: result.insertId, version_number: versionNumber };
  }

  async getVersions(resumeId) {
    const [rows] = await pool.execute(
      'SELECT id, version_number, created_at FROM aicp_resume_versions WHERE resume_id = ? ORDER BY version_number DESC LIMIT 20',
      [resumeId]
    );
    return rows;
  }

  async getVersion(versionId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_resume_versions WHERE id = ?', [versionId]);
    return rows[0];
  }

  async updateScore(id, score) {
    await pool.execute('UPDATE aicp_resumes SET ats_score = ? WHERE id = ?', [score, id]);
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
      FROM aicp_resumes
      GROUP BY range_label
      ORDER BY MIN(ats_score) DESC
    `);
    return rows;
  }

  async getAverageScore() {
    const [rows] = await pool.execute('SELECT AVG(ats_score) as avg_score FROM aicp_resumes WHERE ats_score > 0');
    return Math.round(rows[0].avg_score || 0);
  }
}

module.exports = new ResumeRepository();
