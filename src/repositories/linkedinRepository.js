const pool = require('../config/database');

class LinkedinRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_linkedin_profiles WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_linkedin_profiles WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
    return rows;
  }

  async findLatest(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_linkedin_profiles WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [userId]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_linkedin_profiles (user_id, original_headline, optimized_headline, original_about, optimized_about, skill_recommendations, keyword_suggestions, overall_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.originalHeadline || '', data.optimizedHeadline || '', data.originalAbout || '', data.optimizedAbout || '', JSON.stringify(data.skillRecommendations || []), JSON.stringify(data.keywordSuggestions || []), data.overallScore || 0]
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
    await pool.execute(`UPDATE aicp_linkedin_profiles SET ${fields.join(', ')} WHERE id = ?`, values);
  }
}

module.exports = new LinkedinRepository();
