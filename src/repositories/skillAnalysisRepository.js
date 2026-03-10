const pool = require('../config/database');

class SkillAnalysisRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM skill_analyses WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM skill_analyses WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO skill_analyses (user_id, target_role, current_skills, missing_skills, learning_roadmap, recommended_courses, match_percentage) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.userId, data.targetRole, JSON.stringify(data.currentSkills || []), JSON.stringify(data.missingSkills || []), JSON.stringify(data.learningRoadmap || []), JSON.stringify(data.recommendedCourses || []), data.matchPercentage || 0]
    );
    return { id: result.insertId, ...data };
  }

  async getGapsByDepartment() {
    const [rows] = await pool.execute(`
      SELECT u.department, AVG(s.match_percentage) as avg_match, COUNT(*) as analyses_count
      FROM skill_analyses s
      JOIN users u ON s.user_id = u.id
      GROUP BY u.department
    `);
    return rows;
  }
}

module.exports = new SkillAnalysisRepository();
