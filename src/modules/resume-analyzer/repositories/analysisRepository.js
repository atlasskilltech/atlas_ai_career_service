const pool = require('../../../config/database');

class AnalysisRepository {
  /**
   * Create a new resume analysis record
   */
  async createAnalysis(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_resume_analysis
       (user_id, resume_id, job_description, ats_score, keyword_match_score, skills_match_score, formatting_score, content_score, experience_score, resume_text, parsed_resume)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.userId,
        data.resumeId || null,
        data.jobDescription || '',
        data.atsScore || 0,
        data.keywordMatchScore || 0,
        data.skillsMatchScore || 0,
        data.formattingScore || 0,
        data.contentScore || 0,
        data.experienceScore || 0,
        (data.resumeText || '').substring(0, 10000),
        JSON.stringify(data.parsedResume || {}),
      ]
    );
    return { id: result.insertId, ...data };
  }

  /**
   * Save keywords for an analysis
   */
  async saveKeywords(analysisId, keywords) {
    if (!keywords || keywords.length === 0) return;
    const values = keywords.map(k => [analysisId, k.keyword, k.is_present ? 1 : 0, k.category || 'general']);
    for (const row of values) {
      await pool.execute(
        'INSERT INTO aicp_resume_keywords (analysis_id, keyword, is_present, category) VALUES (?, ?, ?, ?)',
        row
      );
    }
  }

  /**
   * Save missing skills for an analysis
   */
  async saveMissingSkills(analysisId, skills) {
    if (!skills || skills.length === 0) return;
    for (const skill of skills) {
      await pool.execute(
        'INSERT INTO aicp_resume_missing_skills (analysis_id, skill_name, importance) VALUES (?, ?, ?)',
        [analysisId, skill.skill || skill.skill_name, skill.importance || 'recommended']
      );
    }
  }

  /**
   * Save formatting issues for an analysis
   */
  async saveFormatIssues(analysisId, issues) {
    if (!issues || issues.length === 0) return;
    for (const issue of issues) {
      await pool.execute(
        'INSERT INTO aicp_resume_format_issues (analysis_id, issue_type, description, severity) VALUES (?, ?, ?, ?)',
        [analysisId, issue.type || issue.issue_type, issue.description, issue.severity || 'medium']
      );
    }
  }

  /**
   * Save suggestions for an analysis
   */
  async saveSuggestions(analysisId, suggestions) {
    if (!suggestions || suggestions.length === 0) return;
    let priority = 0;
    for (const suggestion of suggestions) {
      const text = typeof suggestion === 'string' ? suggestion : suggestion.suggestion || suggestion.suggestion_text;
      const category = typeof suggestion === 'string' ? 'general' : suggestion.category || 'general';
      await pool.execute(
        'INSERT INTO aicp_resume_suggestions (analysis_id, suggestion_text, category, priority) VALUES (?, ?, ?, ?)',
        [analysisId, text, category, priority++]
      );
    }
  }

  /**
   * Get analysis by ID with all related data
   */
  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_resume_analysis WHERE id = ?', [id]);
    if (!rows[0]) return null;

    const analysis = rows[0];
    const [keywords] = await pool.execute('SELECT * FROM aicp_resume_keywords WHERE analysis_id = ?', [id]);
    const [missingSkills] = await pool.execute('SELECT * FROM aicp_resume_missing_skills WHERE analysis_id = ?', [id]);
    const [formatIssues] = await pool.execute('SELECT * FROM aicp_resume_format_issues WHERE analysis_id = ?', [id]);
    const [suggestions] = await pool.execute('SELECT * FROM aicp_resume_suggestions WHERE analysis_id = ? ORDER BY priority', [id]);

    return {
      ...analysis,
      keywords,
      missing_skills: missingSkills,
      format_issues: formatIssues,
      suggestions,
    };
  }

  /**
   * Get analysis history for a user
   */
  async findByUserId(userId, limit = 20) {
    const [rows] = await pool.execute(
      'SELECT id, resume_id, ats_score, keyword_match_score, skills_match_score, formatting_score, content_score, experience_score, created_at FROM aicp_resume_analysis WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows;
  }

  /**
   * Get analysis history for a specific resume
   */
  async findByResumeId(userId, resumeId, limit = 10) {
    const [rows] = await pool.execute(
      'SELECT id, resume_id, ats_score, keyword_match_score, skills_match_score, formatting_score, content_score, experience_score, created_at FROM aicp_resume_analysis WHERE user_id = ? AND resume_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, resumeId, limit]
    );
    return rows;
  }

  /**
   * Delete an analysis and all related data (cascade handles it)
   */
  async delete(id) {
    await pool.execute('DELETE FROM aicp_resume_analysis WHERE id = ?', [id]);
  }

  /**
   * Get average scores for a user
   */
  async getUserAverageScores(userId) {
    const [rows] = await pool.execute(
      `SELECT
        ROUND(AVG(ats_score)) as avg_ats_score,
        ROUND(AVG(keyword_match_score)) as avg_keyword_score,
        ROUND(AVG(skills_match_score)) as avg_skills_score,
        ROUND(AVG(formatting_score)) as avg_formatting_score,
        COUNT(*) as total_analyses
       FROM aicp_resume_analysis WHERE user_id = ?`,
      [userId]
    );
    return rows[0];
  }
}

module.exports = new AnalysisRepository();
