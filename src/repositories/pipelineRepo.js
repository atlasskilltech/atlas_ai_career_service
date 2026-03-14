const pool = require('../config/database');

class PipelineRepo {
  // ─── Pipeline CRUD ────────────────────────────────────

  async ensurePipelineEntry(applicationId, jobId, userId, stage) {
    const [existing] = await pool.execute(
      'SELECT id FROM aicp_application_pipeline WHERE application_id = ?',
      [applicationId]
    );
    if (existing.length) return existing[0].id;

    const [result] = await pool.execute(
      `INSERT INTO aicp_application_pipeline (application_id, job_id, user_id, stage, sort_order)
       VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(p2.sort_order), 0) + 1 FROM aicp_application_pipeline p2 WHERE p2.job_id = ? AND p2.stage = ?))`,
      [applicationId, jobId, userId, stage || 'applied', jobId, stage || 'applied']
    );
    return result.insertId;
  }

  async syncFromApplications(jobId) {
    // Ensure all applications have pipeline entries
    const [apps] = await pool.execute(
      `SELECT a.id, a.job_id, a.user_id, a.stage
       FROM aicp_admin_job_applications a
       LEFT JOIN aicp_application_pipeline p ON p.application_id = a.id
       WHERE a.job_id = ? AND p.id IS NULL`,
      [jobId]
    );
    for (const app of apps) {
      await this.ensurePipelineEntry(app.id, app.job_id, app.user_id, app.stage);
    }
    return apps.length;
  }

  async getPipelineByJob(jobId, filters = {}) {
    let where = ['p.job_id = ?'];
    let params = [jobId];

    if (filters.search) {
      where.push('(u.name LIKE ? OR u.email LIKE ? OR sp.student_id LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.program) {
      where.push('sp.program = ?');
      params.push(filters.program);
    }
    if (filters.branch) {
      where.push('sp.branch = ?');
      params.push(filters.branch);
    }
    if (filters.priority) {
      where.push('p.priority = ?');
      params.push(filters.priority);
    }

    const [rows] = await pool.execute(
      `SELECT p.*,
        a.applied_at, a.ats_match_score,
        u.name, u.email, u.avatar,
        sp.program, sp.branch, sp.cgpa, sp.graduation_year, sp.student_id,
        r.file_path as resume_path
       FROM aicp_application_pipeline p
       JOIN aicp_admin_job_applications a ON a.id = p.application_id
       JOIN aicp_users u ON u.id = p.user_id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = p.user_id
       LEFT JOIN aicp_resumes r ON r.user_id = p.user_id AND r.is_primary = 1
       WHERE ${where.join(' AND ')}
       ORDER BY p.sort_order ASC, a.applied_at DESC`,
      params
    );
    return rows;
  }

  async moveCard(applicationId, toStage, changedBy, reason) {
    // Get current state
    const [current] = await pool.execute(
      'SELECT p.*, a.job_id, a.user_id FROM aicp_application_pipeline p JOIN aicp_admin_job_applications a ON a.id = p.application_id WHERE p.application_id = ?',
      [applicationId]
    );
    if (!current.length) throw new Error('Pipeline entry not found');

    const entry = current[0];
    const fromStage = entry.stage;

    // Get max sort order in target stage
    const [maxSort] = await pool.execute(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 as next_sort FROM aicp_application_pipeline WHERE job_id = ? AND stage = ?',
      [entry.job_id, toStage]
    );

    // Update pipeline
    await pool.execute(
      'UPDATE aicp_application_pipeline SET stage = ?, sort_order = ?, updated_at = NOW() WHERE application_id = ?',
      [toStage, maxSort[0].next_sort, applicationId]
    );

    // Sync to applications table
    await pool.execute(
      'UPDATE aicp_admin_job_applications SET stage = ? WHERE id = ?',
      [toStage, applicationId]
    );

    // Audit log
    await pool.execute(
      `INSERT INTO aicp_pipeline_audit (application_id, job_id, user_id, from_stage, to_stage, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [applicationId, entry.job_id, entry.user_id, fromStage, toStage, changedBy, reason || null]
    );

    return { fromStage, toStage, userId: entry.user_id, jobId: entry.job_id, applicationId };
  }

  async reorderCards(jobId, stage, orderedIds) {
    for (let i = 0; i < orderedIds.length; i++) {
      await pool.execute(
        'UPDATE aicp_application_pipeline SET sort_order = ? WHERE application_id = ? AND job_id = ? AND stage = ?',
        [i + 1, orderedIds[i], jobId, stage]
      );
    }
  }

  async updatePriority(applicationId, priority) {
    await pool.execute(
      'UPDATE aicp_application_pipeline SET priority = ? WHERE application_id = ?',
      [priority, applicationId]
    );
  }

  async updateNotes(applicationId, notes) {
    await pool.execute(
      'UPDATE aicp_application_pipeline SET notes = ? WHERE application_id = ?',
      [notes, applicationId]
    );
  }

  // ─── Audit / History ─────────────────────────────────

  async getAuditLog(applicationId) {
    const [rows] = await pool.execute(
      `SELECT pa.*, u.name as changed_by_name
       FROM aicp_pipeline_audit pa
       LEFT JOIN aicp_users u ON u.id = pa.changed_by
       WHERE pa.application_id = ?
       ORDER BY pa.created_at DESC`,
      [applicationId]
    );
    return rows;
  }

  async getJobAuditLog(jobId, limit = 50) {
    const [rows] = await pool.execute(
      `SELECT pa.*, u.name as student_name, u2.name as changed_by_name
       FROM aicp_pipeline_audit pa
       JOIN aicp_users u ON u.id = pa.user_id
       LEFT JOIN aicp_users u2 ON u2.id = pa.changed_by
       WHERE pa.job_id = ?
       ORDER BY pa.created_at DESC
       LIMIT ${parseInt(limit)}`,
      [jobId]
    );
    return rows;
  }

  async getTimelineByJob(jobId) {
    const [rows] = await pool.execute(
      `SELECT
        p.application_id, p.stage as current_stage, p.priority, p.sort_order,
        a.applied_at, a.ats_match_score,
        u.name, u.email, u.avatar,
        sp.program, sp.branch, sp.cgpa, sp.graduation_year, sp.student_id,
        r.file_path as resume_path
       FROM aicp_application_pipeline p
       JOIN aicp_admin_job_applications a ON a.id = p.application_id
       JOIN aicp_users u ON u.id = p.user_id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = p.user_id
       LEFT JOIN aicp_resumes r ON r.user_id = p.user_id AND r.is_primary = 1
       WHERE p.job_id = ?
       ORDER BY a.applied_at DESC`,
      [jobId]
    );

    // Get audit history for each applicant
    for (const row of rows) {
      const [history] = await pool.execute(
        `SELECT from_stage, to_stage, created_at, change_reason
         FROM aicp_pipeline_audit
         WHERE application_id = ?
         ORDER BY created_at ASC`,
        [row.application_id]
      );
      row.history = history;
    }
    return rows;
  }

  // ─── Pipeline Stats ───────────────────────────────────

  async getPipelineStats(jobId) {
    const [rows] = await pool.execute(
      `SELECT stage, COUNT(*) as count,
        AVG(a.ats_match_score) as avg_score
       FROM aicp_application_pipeline p
       JOIN aicp_admin_job_applications a ON a.id = p.application_id
       WHERE p.job_id = ?
       GROUP BY stage`,
      [jobId]
    );
    const stats = {
      applied: { count: 0, avg_score: 0 },
      shortlisted: { count: 0, avg_score: 0 },
      interview: { count: 0, avg_score: 0 },
      offered: { count: 0, avg_score: 0 },
      rejected: { count: 0, avg_score: 0 },
      withdrawn: { count: 0, avg_score: 0 },
    };
    rows.forEach(r => {
      stats[r.stage] = { count: r.count, avg_score: Math.round(r.avg_score || 0) };
    });
    stats.total = Object.values(stats).reduce((s, v) => s + v.count, 0);
    return stats;
  }

  // ─── Job details for pipeline page ────────────────────

  async getJobForPipeline(jobId) {
    const [rows] = await pool.execute(
      'SELECT id, company_name, company_logo, role_title, job_type, status FROM aicp_admin_jobs WHERE id = ?',
      [jobId]
    );
    return rows[0] || null;
  }

  // ─── Get student email for notifications ──────────────

  async getApplicantEmail(applicationId) {
    const [rows] = await pool.execute(
      `SELECT u.name, u.email, j.role_title, j.company_name
       FROM aicp_admin_job_applications a
       JOIN aicp_users u ON u.id = a.user_id
       JOIN aicp_admin_jobs j ON j.id = a.job_id
       WHERE a.id = ?`,
      [applicationId]
    );
    return rows[0] || null;
  }

  // ─── Filter options ───────────────────────────────────

  async getFilterOptions(jobId) {
    const [programs] = await pool.execute(
      `SELECT DISTINCT sp.program FROM aicp_application_pipeline p
       JOIN aicp_student_profiles sp ON sp.user_id = p.user_id
       WHERE p.job_id = ? AND sp.program IS NOT NULL ORDER BY sp.program`,
      [jobId]
    );
    const [branches] = await pool.execute(
      `SELECT DISTINCT sp.branch FROM aicp_application_pipeline p
       JOIN aicp_student_profiles sp ON sp.user_id = p.user_id
       WHERE p.job_id = ? AND sp.branch IS NOT NULL ORDER BY sp.branch`,
      [jobId]
    );
    return {
      programs: programs.map(r => r.program),
      branches: branches.map(r => r.branch),
    };
  }

  // ─── Jobs list for pipeline selection ─────────────────

  async getJobsWithApplicants() {
    const [rows] = await pool.execute(
      `SELECT j.id, j.company_name, j.company_logo, j.role_title, j.job_type, j.status,
        COUNT(a.id) as total_applicants
       FROM aicp_admin_jobs j
       LEFT JOIN aicp_admin_job_applications a ON a.job_id = j.id
       GROUP BY j.id
       HAVING total_applicants > 0
       ORDER BY j.created_at DESC`
    );
    return rows;
  }
}

module.exports = new PipelineRepo();
