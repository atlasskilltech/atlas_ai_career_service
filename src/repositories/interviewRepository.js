const pool = require('../config/database');

class InterviewRepository {
  // --- Interviews ---
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_interviews WHERE id = ?', [id]);
    return rows[0];
  }

  async findByUserId(userId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_interviews WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows;
  }

  async create(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_interviews (user_id, job_role, company, interview_type, difficulty, status) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.jobRole || 'Software Engineer', data.company || null, data.interviewType || 'behavioral', data.difficulty || 'medium', 'setup']
    );
    return { id: result.insertId, ...data };
  }

  async updateInterview(id, data) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(typeof value === 'object' && value !== null ? JSON.stringify(value) : value);
    }
    values.push(id);
    await pool.execute(`UPDATE aicp_interviews SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  // --- Questions ---
  async addQuestion(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_interview_questions (interview_id, question, question_order, is_follow_up, parent_question_id) VALUES (?, ?, ?, ?, ?)',
      [data.interviewId, data.question, data.questionOrder, data.isFollowUp ? 1 : 0, data.parentQuestionId || null]
    );
    return { id: result.insertId, ...data };
  }

  async addQuestions(interviewId, questions) {
    const results = [];
    for (let i = 0; i < questions.length; i++) {
      const q = await this.addQuestion({
        interviewId,
        question: questions[i],
        questionOrder: i + 1,
        isFollowUp: false,
      });
      results.push(q);
    }
    return results;
  }

  async getQuestions(interviewId) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_interview_questions WHERE interview_id = ? ORDER BY question_order ASC',
      [interviewId]
    );
    return rows;
  }

  async getQuestion(questionId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_interview_questions WHERE id = ?', [questionId]);
    return rows[0];
  }

  async getQuestionCount(interviewId) {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM aicp_interview_questions WHERE interview_id = ?', [interviewId]);
    return rows[0].count;
  }

  // --- Answers ---
  async saveAnswer(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_interview_answers (question_id, interview_id, answer_text, answer_duration_seconds, filler_words_count, word_count) VALUES (?, ?, ?, ?, ?, ?)',
      [data.questionId, data.interviewId, data.answerText, data.answerDuration || 0, data.fillerWordsCount || 0, data.wordCount || 0]
    );
    return { id: result.insertId, ...data };
  }

  async getAnswers(interviewId) {
    const [rows] = await pool.execute(
      'SELECT a.*, q.question, q.question_order, q.is_follow_up FROM aicp_interview_answers a JOIN aicp_interview_questions q ON a.question_id = q.id WHERE a.interview_id = ? ORDER BY q.question_order ASC',
      [interviewId]
    );
    return rows;
  }

  async getAnswerCount(interviewId) {
    const [rows] = await pool.execute('SELECT COUNT(*) as count FROM aicp_interview_answers WHERE interview_id = ?', [interviewId]);
    return rows[0].count;
  }

  // --- Results ---
  async saveResult(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_interview_results (interview_id, user_id, technical_score, communication_score, confidence_score, problem_solving_score, overall_score, strengths, weaknesses, suggestions, detailed_feedback, question_feedback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        data.interviewId, data.userId,
        data.technicalScore || 0, data.communicationScore || 0, data.confidenceScore || 0,
        data.problemSolvingScore || 0, data.overallScore || 0,
        JSON.stringify(data.strengths || []), JSON.stringify(data.weaknesses || []),
        JSON.stringify(data.suggestions || []), data.detailedFeedback || '',
        JSON.stringify(data.questionFeedback || []),
      ]
    );
    return { id: result.insertId, ...data };
  }

  async getResult(interviewId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_interview_results WHERE interview_id = ?', [interviewId]);
    return rows[0];
  }

  async getResultsByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT r.*, i.job_role, i.company, i.interview_type, i.difficulty, i.duration_seconds, i.total_questions, i.completed_at
       FROM aicp_interview_results r
       JOIN aicp_interviews i ON r.interview_id = i.id
       WHERE r.user_id = ? ORDER BY r.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async getAverageScores(userId) {
    const [rows] = await pool.execute(`
      SELECT
        ROUND(AVG(technical_score)) as avg_technical,
        ROUND(AVG(communication_score)) as avg_communication,
        ROUND(AVG(confidence_score)) as avg_confidence,
        ROUND(AVG(problem_solving_score)) as avg_problem_solving,
        ROUND(AVG(overall_score)) as avg_overall,
        COUNT(*) as total
      FROM aicp_interview_results WHERE user_id = ?
    `, [userId]);
    return rows[0];
  }

  async getSuccessRate() {
    const [rows] = await pool.execute('SELECT AVG(overall_score) as avg_score FROM aicp_interview_results');
    return Math.round(rows[0].avg_score || 0);
  }
}

module.exports = new InterviewRepository();
