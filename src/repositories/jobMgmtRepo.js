const pool = require('../config/database');

class JobMgmtRepo {
  // ─── Jobs CRUD ──────────────────────────────────────────

  async createJob(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_admin_jobs
        (company_name, company_logo, role_title, job_type, ctc_min, ctc_max, ctc_currency,
         location, work_mode, description, cgpa_cutoff, eligible_programs, eligible_branches,
         eligible_years, application_deadline, joining_date, selection_notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.company_name, data.company_logo || null, data.role_title, data.job_type || 'full_time',
        data.ctc_min || null, data.ctc_max || null, data.ctc_currency || 'INR',
        data.location || null, data.work_mode || 'onsite', data.description || null,
        data.cgpa_cutoff || null,
        data.eligible_programs ? JSON.stringify(data.eligible_programs) : null,
        data.eligible_branches ? JSON.stringify(data.eligible_branches) : null,
        data.eligible_years ? JSON.stringify(data.eligible_years) : null,
        data.application_deadline || null, data.joining_date || null,
        data.selection_notes || null, data.status || 'draft', data.created_by || null,
      ]
    );
    return result.insertId;
  }

  async updateJob(id, data) {
    const fields = [];
    const values = [];
    const allowed = [
      'company_name', 'company_logo', 'role_title', 'job_type', 'ctc_min', 'ctc_max',
      'ctc_currency', 'location', 'work_mode', 'description', 'cgpa_cutoff',
      'eligible_programs', 'eligible_branches', 'eligible_years',
      'application_deadline', 'joining_date', 'selection_notes', 'status',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        const val = ['eligible_programs', 'eligible_branches', 'eligible_years'].includes(key)
          ? JSON.stringify(data[key]) : data[key];
        values.push(val);
      }
    }
    if (!fields.length) return;
    values.push(id);
    await pool.execute(`UPDATE aicp_admin_jobs SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async updateStatus(id, status) {
    await pool.execute('UPDATE aicp_admin_jobs SET status = ? WHERE id = ?', [status, id]);
  }

  async deleteJob(id) {
    await pool.execute('DELETE FROM aicp_admin_jobs WHERE id = ?', [id]);
  }

  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_admin_jobs WHERE id = ?', [id]);
    const job = rows[0] || null;
    if (job) {
      if (typeof job.eligible_programs === 'string') job.eligible_programs = JSON.parse(job.eligible_programs);
      if (typeof job.eligible_branches === 'string') job.eligible_branches = JSON.parse(job.eligible_branches);
      if (typeof job.eligible_years === 'string') job.eligible_years = JSON.parse(job.eligible_years);
    }
    return job;
  }

  async findJobs(filters = {}) {
    let where = ['1=1'];
    let params = [];

    if (filters.status) {
      where.push('j.status = ?');
      params.push(filters.status);
    }
    if (filters.company) {
      where.push('j.company_name LIKE ?');
      params.push(`%${filters.company}%`);
    }
    if (filters.role) {
      where.push('j.role_title LIKE ?');
      params.push(`%${filters.role}%`);
    }
    if (filters.job_type) {
      where.push('j.job_type = ?');
      params.push(filters.job_type);
    }
    if (filters.work_mode) {
      where.push('j.work_mode = ?');
      params.push(filters.work_mode);
    }
    if (filters.location) {
      where.push('j.location LIKE ?');
      params.push(`%${filters.location}%`);
    }
    if (filters.ctc_min) {
      where.push('j.ctc_max >= ?');
      params.push(parseFloat(filters.ctc_min));
    }
    if (filters.ctc_max) {
      where.push('j.ctc_min <= ?');
      params.push(parseFloat(filters.ctc_max));
    }
    if (filters.deadline_from) {
      where.push('j.application_deadline >= ?');
      params.push(filters.deadline_from);
    }
    if (filters.deadline_to) {
      where.push('j.application_deadline <= ?');
      params.push(filters.deadline_to);
    }
    if (filters.search) {
      where.push('(j.company_name LIKE ? OR j.role_title LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const sortMap = {
      newest: 'j.created_at DESC',
      oldest: 'j.created_at ASC',
      deadline: 'j.application_deadline ASC',
      company: 'j.company_name ASC',
      ctc: 'j.ctc_max DESC',
    };
    const orderBy = sortMap[filters.sort] || 'j.created_at DESC';

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 25;
    const offset = (page - 1) * limit;

    const [countRows] = await pool.execute(
      `SELECT COUNT(*) as total FROM aicp_admin_jobs j WHERE ${where.join(' AND ')}`,
      params
    );
    const total = countRows[0].total;

    const [rows] = await pool.execute(
      `SELECT j.*,
        (SELECT COUNT(*) FROM aicp_admin_job_applications WHERE job_id = j.id)
        + COALESCE((SELECT COUNT(*) FROM aicp_job_applications ja JOIN aicp_aggregated_jobs ag ON ag.id = ja.job_id WHERE ag.source = 'manual' AND ag.external_id = CONCAT('admin-job-', j.id) AND ja.user_id NOT IN (SELECT user_id FROM aicp_admin_job_applications WHERE job_id = j.id)), 0)
        as total_applicants,
        (SELECT COUNT(*) FROM aicp_admin_job_applications WHERE job_id = j.id AND stage = 'applied') as applied_count,
        (SELECT COUNT(*) FROM aicp_admin_job_applications WHERE job_id = j.id AND stage = 'shortlisted') as shortlisted_count,
        (SELECT COUNT(*) FROM aicp_admin_job_applications WHERE job_id = j.id AND stage = 'interview') as interview_count,
        (SELECT COUNT(*) FROM aicp_admin_job_applications WHERE job_id = j.id AND stage = 'offered') as offer_count
       FROM aicp_admin_jobs j
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    rows.forEach(r => {
      if (typeof r.eligible_programs === 'string') r.eligible_programs = JSON.parse(r.eligible_programs);
      if (typeof r.eligible_branches === 'string') r.eligible_branches = JSON.parse(r.eligible_branches);
      if (typeof r.eligible_years === 'string') r.eligible_years = JSON.parse(r.eligible_years);
    });

    return { jobs: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  // ─── Skills ─────────────────────────────────────────────

  async getJobSkills(jobId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_admin_job_skills WHERE job_id = ? ORDER BY is_required DESC, skill_name', [jobId]);
    return rows;
  }

  async setJobSkills(jobId, skills) {
    await pool.execute('DELETE FROM aicp_admin_job_skills WHERE job_id = ?', [jobId]);
    if (!skills || !skills.length) return;
    const values = skills.map(s => [jobId, s.name || s, typeof s === 'object' ? (s.is_required !== false ? 1 : 0) : 1]);
    for (const v of values) {
      await pool.execute('INSERT INTO aicp_admin_job_skills (job_id, skill_name, is_required) VALUES (?, ?, ?)', v);
    }
  }

  // ─── Interview Rounds ──────────────────────────────────

  async getJobRounds(jobId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_admin_job_rounds WHERE job_id = ? ORDER BY round_number', [jobId]);
    return rows;
  }

  async setJobRounds(jobId, rounds) {
    await pool.execute('DELETE FROM aicp_admin_job_rounds WHERE job_id = ?', [jobId]);
    if (!rounds || !rounds.length) return;
    for (let i = 0; i < rounds.length; i++) {
      const r = rounds[i];
      await pool.execute(
        'INSERT INTO aicp_admin_job_rounds (job_id, round_number, round_name, round_type, description, duration_minutes) VALUES (?, ?, ?, ?, ?, ?)',
        [jobId, i + 1, r.round_name || r.name, r.round_type || 'technical', r.description || null, r.duration_minutes || null]
      );
    }
  }

  // ─── Applications ──────────────────────────────────────

  async getApplicants(jobId, filters = {}) {
    let where = ['a.job_id = ?'];
    let params = [jobId];

    if (filters.stage) {
      where.push('a.stage = ?');
      params.push(filters.stage);
    }
    if (filters.search) {
      where.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const [rows] = await pool.execute(
      `SELECT a.*,
        u.name, u.email, u.avatar,
        sp.program, sp.branch, sp.cgpa, sp.graduation_year, sp.student_id,
        r.file_path as resume_path
       FROM aicp_admin_job_applications a
       JOIN aicp_users u ON u.id = a.user_id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = a.user_id
       LEFT JOIN aicp_resumes r ON r.user_id = a.user_id AND r.is_primary = 1
       WHERE ${where.join(' AND ')}
       ORDER BY a.applied_at DESC`,
      params
    );
    return rows;
  }

  async getApplicantById(appId) {
    const [rows] = await pool.execute(
      `SELECT a.*, u.name, u.email, sp.program, sp.branch, sp.cgpa
       FROM aicp_admin_job_applications a
       JOIN aicp_users u ON u.id = a.user_id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = a.user_id
       WHERE a.id = ?`,
      [appId]
    );
    return rows[0] || null;
  }

  async updateApplicantStage(appId, stage, notes) {
    const updates = ['stage = ?'];
    const params = [stage];
    if (notes !== undefined) {
      updates.push('notes = ?');
      params.push(notes);
    }
    params.push(appId);
    await pool.execute(`UPDATE aicp_admin_job_applications SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  async addApplicantNote(appId, note) {
    await pool.execute('UPDATE aicp_admin_job_applications SET notes = ? WHERE id = ?', [note, appId]);
  }

  async bulkUpdateStage(appIds, stage) {
    if (!appIds.length) return;
    const placeholders = appIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE aicp_admin_job_applications SET stage = ? WHERE id IN (${placeholders})`,
      [stage, ...appIds]
    );
  }

  async getPipelineCounts(jobId) {
    const [rows] = await pool.execute(
      `SELECT stage, COUNT(*) as count FROM aicp_admin_job_applications WHERE job_id = ? GROUP BY stage`,
      [jobId]
    );
    const pipeline = { applied: 0, shortlisted: 0, interview: 0, offered: 0, rejected: 0, withdrawn: 0 };
    rows.forEach(r => { pipeline[r.stage] = r.count; });
    return pipeline;
  }

  // ─── Publish to Job Board ────────────────────────────────

  async publishToJobBoard(job, skills) {
    const externalId = 'admin-job-' + job.id;
    // Check if already published
    const [existing] = await pool.execute(
      "SELECT id FROM aicp_aggregated_jobs WHERE source = 'manual' AND external_id = ?",
      [externalId]
    );

    const skillNames = (skills || []).map(s => s.skill_name || s);
    const skillsJson = skillNames.length ? JSON.stringify(skillNames) : null;

    if (existing.length) {
      // Update existing
      await pool.execute(
        `UPDATE aicp_aggregated_jobs SET
          title = ?, company = ?, location = ?, salary_min = ?, salary_max = ?,
          salary_currency = ?, description = ?, skills = ?, job_type = ?,
          work_mode = ?, company_logo = ?, is_active = ?,
          expires_at = ?, updated_at = NOW()
         WHERE id = ?`,
        [
          job.role_title, job.company_name, job.location,
          job.ctc_min ? Math.round(job.ctc_min * 100000) : null,
          job.ctc_max ? Math.round(job.ctc_max * 100000) : null,
          job.ctc_currency || 'INR', job.description, skillsJson,
          job.job_type, job.work_mode, job.company_logo,
          job.status === 'active' ? 1 : 0,
          job.application_deadline || null,
          existing[0].id,
        ]
      );
      return { aggregated_job_id: existing[0].id, action: 'updated' };
    } else {
      // Insert new
      const [result] = await pool.execute(
        `INSERT INTO aicp_aggregated_jobs
          (external_id, title, company, location, salary_min, salary_max,
           salary_currency, description, skills, job_type, work_mode, source,
           company_logo, is_active, is_verified, posted_date, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?, 1, NOW(), ?)`,
        [
          externalId, job.role_title, job.company_name, job.location,
          job.ctc_min ? Math.round(job.ctc_min * 100000) : null,
          job.ctc_max ? Math.round(job.ctc_max * 100000) : null,
          job.ctc_currency || 'INR', job.description, skillsJson,
          job.job_type, job.work_mode, job.company_logo,
          job.status === 'active' ? 1 : 0,
          job.application_deadline || null,
        ]
      );
      return { aggregated_job_id: result.insertId, action: 'published' };
    }
  }

  async unpublishFromJobBoard(jobId) {
    const externalId = 'admin-job-' + jobId;
    await pool.execute(
      "DELETE FROM aicp_aggregated_jobs WHERE source = 'manual' AND external_id = ?",
      [externalId]
    );
  }

  async isPublished(jobId) {
    const externalId = 'admin-job-' + jobId;
    const [rows] = await pool.execute(
      "SELECT id FROM aicp_aggregated_jobs WHERE source = 'manual' AND external_id = ?",
      [externalId]
    );
    return rows.length > 0;
  }

  // ─── Filter Options ─────────────────────────────────────

  async getDistinctCompanies() {
    const [rows] = await pool.execute('SELECT DISTINCT company_name FROM aicp_admin_jobs ORDER BY company_name');
    return rows.map(r => r.company_name);
  }

  async getDistinctLocations() {
    const [rows] = await pool.execute('SELECT DISTINCT location FROM aicp_admin_jobs WHERE location IS NOT NULL ORDER BY location');
    return rows.map(r => r.location);
  }

  // ─── Stats ──────────────────────────────────────────────

  async getStats() {
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) as total_jobs,
        SUM(status = 'active') as active_jobs,
        SUM(status = 'draft') as draft_jobs,
        SUM(status = 'closed') as closed_jobs,
        (SELECT COUNT(*) FROM aicp_admin_job_applications)
        + (SELECT COUNT(*) FROM aicp_job_applications ja JOIN aicp_aggregated_jobs ag ON ag.id = ja.job_id WHERE ag.source = 'manual')
        as total_applications,
        (SELECT COUNT(*) FROM aicp_admin_job_applications WHERE stage = 'offered') as total_offers
      FROM aicp_admin_jobs
    `);
    return rows[0];
  }
}

module.exports = new JobMgmtRepo();
