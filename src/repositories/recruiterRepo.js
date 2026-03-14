const pool = require('../config/database');

class RecruiterRepo {
  // ─── CRUD ─────────────────────────────────────────────────

  async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_recruiters
       (company_name, logo, website, industry, company_size, mou_status, mou_expiry,
        contact_name, contact_role, contact_email, contact_phone, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.company_name, data.logo || null, data.website || null,
        data.industry || null, data.company_size || null,
        data.mou_status || 'none', data.mou_expiry || null,
        data.contact_name || null, data.contact_role || null,
        data.contact_email || null, data.contact_phone || null,
        data.notes || null, data.created_by || null
      ]
    );
    return result.insertId;
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    const allowed = [
      'company_name', 'logo', 'website', 'industry', 'company_size',
      'mou_status', 'mou_expiry', 'contact_name', 'contact_role',
      'contact_email', 'contact_phone', 'notes'
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key] || null);
      }
    }
    if (!fields.length) return;
    values.push(id);
    await pool.execute(
      `UPDATE aicp_recruiters SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  async findById(id) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_recruiters WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  async findAll(filters = {}) {
    let sql = 'SELECT * FROM aicp_recruiters WHERE 1=1';
    const params = [];

    if (filters.search) {
      sql += ' AND (company_name LIKE ? OR contact_name LIKE ? OR contact_email LIKE ?)';
      const s = `%${filters.search}%`;
      params.push(s, s, s);
    }
    if (filters.industry) {
      sql += ' AND industry = ?';
      params.push(filters.industry);
    }
    if (filters.tier) {
      sql += ' AND tier = ?';
      params.push(filters.tier);
    }
    if (filters.mou_status) {
      sql += ' AND mou_status = ?';
      params.push(filters.mou_status);
    }
    if (filters.company_size) {
      sql += ' AND company_size = ?';
      params.push(filters.company_size);
    }
    if (filters.hire_min) {
      sql += ` AND id IN (
        SELECT r.id FROM aicp_recruiters r
        LEFT JOIN aicp_admin_job_applications aa ON aa.job_id IN (SELECT aj.id FROM aicp_admin_jobs aj WHERE aj.company_name = r.company_name) AND aa.stage = 'offered'
        GROUP BY r.id HAVING COUNT(aa.id) >= ?
      )`;
      params.push(Number(filters.hire_min));
    }
    if (filters.hire_max) {
      sql += ` AND id IN (
        SELECT r.id FROM aicp_recruiters r
        LEFT JOIN aicp_admin_job_applications aa ON aa.job_id IN (SELECT aj.id FROM aicp_admin_jobs aj WHERE aj.company_name = r.company_name) AND aa.stage = 'offered'
        GROUP BY r.id HAVING COUNT(aa.id) <= ?
      )`;
      params.push(Number(filters.hire_max));
    }

    sql += ' ORDER BY tier_score DESC, company_name ASC LIMIT 200';
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  // ─── Stats for a recruiter ────────────────────────────────

  async getStats(recruiterId) {
    const recruiter = await this.findById(recruiterId);
    if (!recruiter) return null;
    const companyName = recruiter.company_name;

    // Jobs posted (admin jobs)
    const [jobRows] = await pool.execute(
      `SELECT COUNT(*) AS total_jobs FROM aicp_admin_jobs WHERE company_name = ?`,
      [companyName]
    );

    // Students hired (offered stage)
    const [hiredRows] = await pool.execute(
      `SELECT COUNT(DISTINCT aa.user_id) AS total_hired
       FROM aicp_admin_job_applications aa
       JOIN aicp_admin_jobs aj ON aa.job_id = aj.id
       WHERE aj.company_name = ? AND aa.stage = 'offered'`,
      [companyName]
    );

    // Avg CTC
    const [ctcRows] = await pool.execute(
      `SELECT AVG(aj.ctc_max) AS avg_ctc
       FROM aicp_admin_jobs aj
       WHERE aj.company_name = ? AND aj.ctc_max IS NOT NULL AND aj.ctc_max > 0`,
      [companyName]
    );

    // Total applicants (for conversion rate)
    const [applicantRows] = await pool.execute(
      `SELECT COUNT(*) AS total_applicants
       FROM aicp_admin_job_applications aa
       JOIN aicp_admin_jobs aj ON aa.job_id = aj.id
       WHERE aj.company_name = ?`,
      [companyName]
    );

    const totalJobs = jobRows[0].total_jobs;
    const totalHired = hiredRows[0].total_hired;
    const avgCtc = Math.round(ctcRows[0].avg_ctc || 0);
    const totalApplicants = applicantRows[0].total_applicants;
    const conversionRate = totalApplicants > 0
      ? Math.round((totalHired / totalApplicants) * 100)
      : 0;

    return { totalJobs, totalHired, avgCtc, conversionRate, totalApplicants };
  }

  // ─── Jobs by this recruiter ───────────────────────────────

  async getJobs(recruiterId) {
    const recruiter = await this.findById(recruiterId);
    if (!recruiter) return [];
    const [rows] = await pool.execute(
      `SELECT id, role_title, job_type, location, work_mode, status, ctc_min, ctc_max,
              application_deadline, created_at
       FROM aicp_admin_jobs WHERE company_name = ? ORDER BY created_at DESC`,
      [recruiter.company_name]
    );
    return rows;
  }

  // ─── Hired students ───────────────────────────────────────

  async getHiredStudents(recruiterId) {
    const recruiter = await this.findById(recruiterId);
    if (!recruiter) return [];
    const [rows] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.department, aj.role_title, aj.ctc_max, aa.applied_at
       FROM aicp_admin_job_applications aa
       JOIN aicp_admin_jobs aj ON aa.job_id = aj.id
       JOIN aicp_users u ON aa.user_id = u.id
       WHERE aj.company_name = ? AND aa.stage = 'offered'
       ORDER BY aa.applied_at DESC`,
      [recruiter.company_name]
    );
    return rows;
  }

  // ─── Interactions ─────────────────────────────────────────

  async getInteractions(recruiterId) {
    const [rows] = await pool.execute(
      `SELECT i.*, u.name AS created_by_name
       FROM aicp_recruiter_interactions i
       LEFT JOIN aicp_users u ON i.created_by = u.id
       WHERE i.recruiter_id = ?
       ORDER BY i.interaction_date DESC`,
      [recruiterId]
    );
    return rows;
  }

  async addInteraction(recruiterId, data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_recruiter_interactions
       (recruiter_id, type, interaction_date, summary, follow_up_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        recruiterId, data.type, data.interaction_date,
        data.summary, data.follow_up_date || null, data.created_by || null
      ]
    );
    // Update last_interaction_at on recruiter
    await pool.execute(
      'UPDATE aicp_recruiters SET last_interaction_at = ? WHERE id = ?',
      [data.interaction_date, recruiterId]
    );
    return result.insertId;
  }

  async markFollowUpDone(interactionId) {
    await pool.execute(
      'UPDATE aicp_recruiter_interactions SET follow_up_done = 1 WHERE id = ?',
      [interactionId]
    );
  }

  // ─── Analytics (hiring trend + CTC by year) ──────────────

  async getAnalytics(recruiterId) {
    const recruiter = await this.findById(recruiterId);
    if (!recruiter) return { hiringTrend: [], ctcByYear: [] };
    const companyName = recruiter.company_name;

    const [hiringTrend] = await pool.execute(
      `SELECT YEAR(aa.applied_at) AS yr, MONTH(aa.applied_at) AS mo,
              COUNT(DISTINCT aa.user_id) AS hired
       FROM aicp_admin_job_applications aa
       JOIN aicp_admin_jobs aj ON aa.job_id = aj.id
       WHERE aj.company_name = ? AND aa.stage = 'offered'
       GROUP BY yr, mo ORDER BY yr, mo`,
      [companyName]
    );

    const [ctcByYear] = await pool.execute(
      `SELECT YEAR(aj.created_at) AS yr, AVG(aj.ctc_max) AS avg_ctc
       FROM aicp_admin_jobs aj
       WHERE aj.company_name = ? AND aj.ctc_max IS NOT NULL AND aj.ctc_max > 0
       GROUP BY yr ORDER BY yr`,
      [companyName]
    );

    return { hiringTrend, ctcByYear };
  }

  // ─── Tier recalculation ───────────────────────────────────

  async recalcTier(recruiterId) {
    const stats = await this.getStats(recruiterId);
    if (!stats) return;

    const score = (stats.totalJobs * 10) + (stats.totalHired * 20) + (stats.avgCtc * 2);
    let tier = 'new';
    if (score >= 200) tier = 'platinum';
    else if (score >= 100) tier = 'gold';
    else if (score >= 50) tier = 'silver';

    await pool.execute(
      'UPDATE aicp_recruiters SET tier = ?, tier_score = ? WHERE id = ?',
      [tier, score, recruiterId]
    );
    return { tier, score };
  }

  async recalcAllTiers() {
    const [all] = await pool.execute('SELECT id FROM aicp_recruiters');
    for (const r of all) {
      await this.recalcTier(r.id);
    }
  }

  // ─── Filter options ───────────────────────────────────────

  async getDistinctIndustries() {
    const [rows] = await pool.execute(
      'SELECT DISTINCT industry FROM aicp_recruiters WHERE industry IS NOT NULL ORDER BY industry'
    );
    return rows.map(r => r.industry);
  }

  // ─── Follow-ups due (for dashboard widget) ────────────────

  async getPendingFollowUps(limit = 10) {
    const [rows] = await pool.execute(
      `SELECT i.id, i.follow_up_date, i.summary, i.type, r.company_name, r.id AS recruiter_id
       FROM aicp_recruiter_interactions i
       JOIN aicp_recruiters r ON i.recruiter_id = r.id
       WHERE i.follow_up_done = 0 AND i.follow_up_date IS NOT NULL AND i.follow_up_date <= DATE_ADD(NOW(), INTERVAL 7 DAY)
       ORDER BY i.follow_up_date ASC LIMIT ?`,
      [limit]
    );
    return rows;
  }
}

module.exports = new RecruiterRepo();
