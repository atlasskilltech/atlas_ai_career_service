const pool = require('../config/database');

class InterviewRepository {
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_mock_interviews WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_mock_interviews WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_mock_interviews (user_id, interview_type, mode, job_role, questions, answers) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.interviewType || 'behavioral', data.mode || 'text', data.jobRole || null, JSON.stringify(data.questions || []), JSON.stringify(data.answers || [])]
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
    await pool.execute(`UPDATE aicp_mock_interviews SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async saveFeedback(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_interview_feedback (interview_id, user_id, confidence_score, communication_score, technical_score, star_score, overall_score, feedback_text, suggestions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [data.interviewId, data.userId, data.confidenceScore || 0, data.communicationScore || 0, data.technicalScore || 0, data.starScore || 0, data.overallScore || 0, data.feedbackText || '', JSON.stringify(data.suggestions || [])]
    );
    return { id: result.insertId, ...data };
  }

  async getFeedback(interviewId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_interview_feedback WHERE interview_id = ?', [interviewId]);
    return rows[0];
  }

  async getFeedbackByUserId(userId) {
    const [rows] = await pool.execute(`
      SELECT f.*, m.interview_type, m.job_role, m.mode
      FROM aicp_interview_feedback f
      JOIN aicp_mock_interviews m ON f.interview_id = m.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `, [userId]);
    return rows;
  }

  async getAverageScores(userId) {
    const [rows] = await pool.execute(`
      SELECT
        AVG(confidence_score) as avg_confidence,
        AVG(communication_score) as avg_communication,
        AVG(technical_score) as avg_technical,
        AVG(overall_score) as avg_overall,
        COUNT(*) as total
      FROM aicp_interview_feedback WHERE user_id = ?
    `, [userId]);
    return rows[0];
  }

  async getSuccessRate() {
    const [rows] = await pool.execute('SELECT AVG(overall_score) as avg_score FROM aicp_interview_feedback');
    return Math.round(rows[0].avg_score || 0);
  }
}

module.exports = new InterviewRepository();
