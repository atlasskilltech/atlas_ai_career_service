const pool = require('../config/database');

class StudentMgmtRepo {
  // ─── Paginated list with filters ─────────────────────────
  async findStudents({ page = 1, limit = 25, search, program, branch, graduationYear, placementStatus, atsMin, atsMax, cgpaMin, cgpaMax, skills, resumeUploaded, lastActive, sortBy = 'u.created_at', sortDir = 'DESC' }) {
    const where = ["u.role = 'student'"];
    const params = [];

    if (search) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR sp.student_id LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (program) { where.push('sp.program = ?'); params.push(program); }
    if (branch) { where.push('sp.branch = ?'); params.push(branch); }
    if (graduationYear) { where.push('sp.graduation_year = ?'); params.push(graduationYear); }
    if (placementStatus) { where.push('sp.placement_status = ?'); params.push(placementStatus); }
    if (atsMin != null) { where.push('COALESCE(r.ats_score, 0) >= ?'); params.push(Number(atsMin)); }
    if (atsMax != null) { where.push('COALESCE(r.ats_score, 0) <= ?'); params.push(Number(atsMax)); }
    if (cgpaMin != null) { where.push('sp.cgpa >= ?'); params.push(Number(cgpaMin)); }
    if (cgpaMax != null) { where.push('sp.cgpa <= ?'); params.push(Number(cgpaMax)); }
    if (resumeUploaded === 'yes') { where.push('r.id IS NOT NULL'); }
    if (resumeUploaded === 'no') { where.push('r.id IS NULL'); }
    if (lastActive) {
      where.push('sp.last_active >= DATE_SUB(NOW(), INTERVAL ? DAY)');
      params.push(Number(lastActive));
    }
    if (skills && skills.length) {
      where.push(`u.id IN (SELECT user_id FROM aicp_student_skills WHERE skill_name IN (${skills.map(() => '?').join(',')}))`);
      params.push(...skills);
    }

    const allowedSorts = {
      'name': 'u.name', 'email': 'u.email', 'program': 'sp.program',
      'branch': 'sp.branch', 'year': 'sp.graduation_year', 'ats_score': 'r.ats_score',
      'cgpa': 'sp.cgpa', 'placement_status': 'sp.placement_status',
      'created_at': 'u.created_at',
    };
    const sort = allowedSorts[sortBy] || 'u.created_at';
    const dir = sortDir === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = where.join(' AND ');
    const offset = (page - 1) * limit;

    // Count
    const countParams = [...params];
    const [countRows] = await pool.execute(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM aicp_users u
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       LEFT JOIN aicp_resumes r ON r.user_id = u.id AND r.is_primary = 1
       WHERE ${whereClause}`,
      countParams
    );

    // Data
    const dataParams = [...params, limit, offset];
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.avatar, u.phone, u.department, u.year_of_study, u.created_at,
              sp.student_id, sp.program, sp.branch, sp.graduation_year, sp.cgpa,
              sp.linkedin_url, sp.github_url, sp.portfolio_url,
              sp.placement_status, sp.last_active,
              COALESCE(r.ats_score, 0) AS ats_score,
              r.id AS resume_id, r.file_path AS resume_path,
              (SELECT JSON_ARRAYAGG(JSON_OBJECT('name', ss.skill_name, 'type', ss.skill_type))
               FROM aicp_student_skills ss WHERE ss.user_id = u.id) AS skills_json
       FROM aicp_users u
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       LEFT JOIN aicp_resumes r ON r.user_id = u.id AND r.is_primary = 1
       WHERE ${whereClause}
       GROUP BY u.id
       ORDER BY ${sort} ${dir}
       LIMIT ? OFFSET ?`,
      dataParams
    );

    return { students: rows, total: countRows[0].total, page, limit };
  }

  // ─── Single student full profile ─────────────────────────
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT u.*, sp.student_id, sp.program, sp.branch, sp.graduation_year, sp.cgpa,
              sp.linkedin_url, sp.github_url, sp.portfolio_url,
              sp.placement_status, sp.last_active,
              COALESCE(r.ats_score, 0) AS ats_score,
              r.id AS resume_id, r.file_path AS resume_path
       FROM aicp_users u
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       LEFT JOIN aicp_resumes r ON r.user_id = u.id AND r.is_primary = 1
       WHERE u.id = ? AND u.role = 'student'`,
      [id]
    );
    return rows[0] || null;
  }

  async getSkills(userId) {
    const [rows] = await pool.execute(
      'SELECT id, skill_name, skill_type, proficiency, added_by FROM aicp_student_skills WHERE user_id = ? ORDER BY skill_type, skill_name',
      [userId]
    );
    return rows;
  }

  async addSkill(userId, skillName, skillType, addedBy = 'admin') {
    await pool.execute(
      `INSERT INTO aicp_student_skills (user_id, skill_name, skill_type, added_by) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE skill_type = VALUES(skill_type)`,
      [userId, skillName, skillType || 'technical', addedBy]
    );
  }

  async removeSkill(userId, skillId) {
    await pool.execute('DELETE FROM aicp_student_skills WHERE id = ? AND user_id = ?', [skillId, userId]);
  }

  async getProjects(userId) {
    const [rows] = await pool.execute(
      `SELECT projects_data FROM aicp_resumes WHERE user_id = ? AND is_primary = 1 LIMIT 1`, [userId]
    );
    if (rows[0] && rows[0].projects_data) {
      try { return typeof rows[0].projects_data === 'string' ? JSON.parse(rows[0].projects_data) : rows[0].projects_data; }
      catch { return []; }
    }
    return [];
  }

  async getInterviewHistory(userId) {
    const [rows] = await pool.execute(
      `SELECT i.id, i.job_role, i.interview_type, i.status, i.completed_at,
              r.overall_score
       FROM aicp_interviews i
       LEFT JOIN aicp_interview_results r ON r.interview_id = i.id
       WHERE i.user_id = ? ORDER BY i.created_at DESC LIMIT 10`,
      [userId]
    );
    return rows;
  }

  async getApplicationHistory(userId) {
    const [rows] = await pool.execute(
      `SELECT a.status, a.applied_at, j.title, j.company
       FROM aicp_job_applications a
       JOIN aicp_aggregated_jobs j ON a.job_id = j.id
       WHERE a.user_id = ? ORDER BY a.applied_at DESC LIMIT 10`,
      [userId]
    );
    return rows;
  }

  // ─── Filter options ──────────────────────────────────────
  async getDistinctPrograms() {
    const [rows] = await pool.execute('SELECT DISTINCT program FROM aicp_student_profiles WHERE program IS NOT NULL ORDER BY program');
    return rows.map(r => r.program);
  }

  async getDistinctBranches() {
    const [rows] = await pool.execute('SELECT DISTINCT branch FROM aicp_student_profiles WHERE branch IS NOT NULL ORDER BY branch');
    return rows.map(r => r.branch);
  }

  async getDistinctGradYears() {
    const [rows] = await pool.execute('SELECT DISTINCT graduation_year FROM aicp_student_profiles WHERE graduation_year IS NOT NULL ORDER BY graduation_year DESC');
    return rows.map(r => r.graduation_year);
  }

  async getDistinctSkills() {
    const [rows] = await pool.execute('SELECT DISTINCT skill_name FROM aicp_student_skills ORDER BY skill_name LIMIT 200');
    return rows.map(r => r.skill_name);
  }

  // ─── Bulk operations ─────────────────────────────────────
  async bulkUpdateStatus(userIds, status) {
    if (!userIds.length) return;
    const placeholders = userIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE aicp_student_profiles SET placement_status = ? WHERE user_id IN (${placeholders})`,
      [status, ...userIds]
    );
  }

  async getStudentEmails(userIds) {
    if (!userIds.length) return [];
    const placeholders = userIds.map(() => '?').join(',');
    const [rows] = await pool.execute(
      `SELECT id, name, email FROM aicp_users WHERE id IN (${placeholders})`,
      userIds
    );
    return rows;
  }

  // ─── Completeness score inputs ───────────────────────────
  async getCompletenessData(userId) {
    const [resumeRows] = await pool.execute(
      'SELECT id, ats_score FROM aicp_resumes WHERE user_id = ? AND is_primary = 1 LIMIT 1', [userId]
    );
    const [skillRows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM aicp_student_skills WHERE user_id = ?', [userId]
    );
    const [linkedinRows] = await pool.execute(
      'SELECT id FROM aicp_linkedin_profiles WHERE user_id = ? LIMIT 1', [userId]
    );
    const [profileRows] = await pool.execute(
      'SELECT github_url FROM aicp_student_profiles WHERE user_id = ? LIMIT 1', [userId]
    );
    const [projectRows] = await pool.execute(
      'SELECT projects_data FROM aicp_resumes WHERE user_id = ? AND is_primary = 1 LIMIT 1', [userId]
    );
    const [interviewRows] = await pool.execute(
      "SELECT id FROM aicp_interviews WHERE user_id = ? AND status = 'completed' LIMIT 1", [userId]
    );

    const hasResume = resumeRows.length > 0;
    const atsScore = resumeRows[0]?.ats_score || 0;
    const hasSkills = skillRows[0].cnt > 0;
    const hasLinkedin = linkedinRows.length > 0;
    const hasGithub = !!(profileRows[0]?.github_url);
    let hasProjects = false;
    if (projectRows[0]?.projects_data) {
      try {
        const p = typeof projectRows[0].projects_data === 'string' ? JSON.parse(projectRows[0].projects_data) : projectRows[0].projects_data;
        hasProjects = Array.isArray(p) && p.length > 0;
      } catch {}
    }
    const hasMockInterview = interviewRows.length > 0;

    return { hasResume, atsScore, hasSkills, hasLinkedin, hasGithub, hasProjects, hasMockInterview };
  }

  // ─── Export: all students (no pagination) ────────────────
  async findAllForExport(filters) {
    const result = await this.findStudents({ ...filters, page: 1, limit: 100000 });
    return result.students;
  }
}

module.exports = new StudentMgmtRepo();
