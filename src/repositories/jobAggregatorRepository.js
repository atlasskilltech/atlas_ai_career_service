const pool = require('../config/database');

class JobAggregatorRepository {
  // ─── Aggregated Jobs ───────────────────────────────────────

  async search({ query, location, category, jobType, workMode, experience, salaryMin, source, page = 1, limit = 20 }) {
    let sql = 'SELECT * FROM aicp_aggregated_jobs WHERE is_active = 1';
    const params = [];

    if (query) {
      sql += ' AND (title LIKE ? OR company LIKE ? OR description LIKE ?)';
      const q = `%${query}%`;
      params.push(q, q, q);
    }
    if (location) {
      sql += ' AND location LIKE ?';
      params.push(`%${location}%`);
    }
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (jobType) {
      sql += ' AND job_type = ?';
      params.push(jobType);
    }
    if (workMode) {
      sql += ' AND work_mode = ?';
      params.push(workMode);
    }
    if (experience !== undefined && experience !== '') {
      sql += ' AND experience_min <= ? AND (experience_max >= ? OR experience_max IS NULL)';
      params.push(Number(experience), Number(experience));
    }
    if (salaryMin) {
      sql += ' AND salary_max >= ?';
      params.push(Number(salaryMin));
    }
    if (source) {
      sql += ' AND source = ?';
      params.push(source);
    }

    // Count query
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countRows] = await pool.execute(countSql, params);
    const total = countRows[0].total;

    // Paginated results
    sql += ' ORDER BY posted_date DESC, created_at DESC';
    const offset = (page - 1) * limit;
    sql += ' LIMIT ? OFFSET ?';
    params.push(String(limit), String(offset));

    const [rows] = await pool.execute(sql, params);
    return { jobs: rows, total, page, totalPages: Math.ceil(total / limit) };
  }

  async findById(id) {
    const [rows] = await pool.execute('SELECT * FROM aicp_aggregated_jobs WHERE id = ?', [id]);
    return rows[0];
  }

  async findByExternalId(source, externalId) {
    const [rows] = await pool.execute('SELECT * FROM aicp_aggregated_jobs WHERE source = ? AND external_id = ?', [source, externalId]);
    return rows[0];
  }

  async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_aggregated_jobs
       (external_id, title, company, location, salary_min, salary_max, salary_currency, experience_min, experience_max, description, skills, category, job_type, work_mode, source, source_url, apply_url, company_logo, is_active, is_verified, posted_date, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.externalId || null, data.title, data.company, data.location || null,
        data.salaryMin || null, data.salaryMax || null, data.salaryCurrency || 'INR',
        data.experienceMin || 0, data.experienceMax || null,
        data.description || null, JSON.stringify(data.skills || []),
        data.category || null, data.jobType || 'full_time', data.workMode || 'onsite',
        data.source, data.sourceUrl || null, data.applyUrl || null,
        data.companyLogo || null, data.isActive !== undefined ? data.isActive : 1,
        data.isVerified || 0, data.postedDate || new Date(), data.expiresAt || null
      ]
    );
    return { id: result.insertId, ...data };
  }

  async upsertByExternal(data) {
    const existing = await this.findByExternalId(data.source, data.externalId);
    if (existing) {
      await pool.execute(
        `UPDATE aicp_aggregated_jobs SET title = ?, company = ?, location = ?, salary_min = ?, salary_max = ?, description = ?, skills = ?, category = ?, apply_url = ?, company_logo = COALESCE(?, company_logo), is_active = 1, updated_at = NOW() WHERE id = ?`,
        [data.title, data.company, data.location || null, data.salaryMin || null, data.salaryMax || null, data.description || null, JSON.stringify(data.skills || []), data.category || null, data.applyUrl || null, data.companyLogo || null, existing.id]
      );
      return { id: existing.id, updated: true };
    }
    return { ...(await this.create(data)), updated: false };
  }

  async update(id, data) {
    const fields = [];
    const values = [];
    const fieldMap = {
      title: 'title', company: 'company', location: 'location',
      salaryMin: 'salary_min', salaryMax: 'salary_max', description: 'description',
      skills: 'skills', category: 'category', jobType: 'job_type', workMode: 'work_mode',
      applyUrl: 'apply_url', isActive: 'is_active', isVerified: 'is_verified', expiresAt: 'expires_at',
      experienceMin: 'experience_min', experienceMax: 'experience_max'
    };
    for (const [key, col] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        fields.push(`${col} = ?`);
        values.push(key === 'skills' ? JSON.stringify(data[key]) : data[key]);
      }
    }
    if (fields.length === 0) return;
    values.push(id);
    await pool.execute(`UPDATE aicp_aggregated_jobs SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  async delete(id) {
    await pool.execute('DELETE FROM aicp_aggregated_jobs WHERE id = ?', [id]);
  }

  async deactivate(id) {
    await pool.execute('UPDATE aicp_aggregated_jobs SET is_active = 0 WHERE id = ?', [id]);
  }

  async getCategories() {
    const [rows] = await pool.execute('SELECT DISTINCT category FROM aicp_aggregated_jobs WHERE category IS NOT NULL AND is_active = 1 ORDER BY category');
    return rows.map(r => r.category);
  }

  async getLocations() {
    const [rows] = await pool.execute('SELECT DISTINCT location FROM aicp_aggregated_jobs WHERE location IS NOT NULL AND is_active = 1 ORDER BY location LIMIT 50');
    return rows.map(r => r.location);
  }

  async getStats() {
    const [total] = await pool.execute('SELECT COUNT(*) as count FROM aicp_aggregated_jobs WHERE is_active = 1');
    const [bySource] = await pool.execute('SELECT source, COUNT(*) as count FROM aicp_aggregated_jobs WHERE is_active = 1 GROUP BY source');
    const [byCategory] = await pool.execute('SELECT category, COUNT(*) as count FROM aicp_aggregated_jobs WHERE is_active = 1 AND category IS NOT NULL GROUP BY category ORDER BY count DESC LIMIT 10');
    const [todayCount] = await pool.execute('SELECT COUNT(*) as count FROM aicp_aggregated_jobs WHERE DATE(created_at) = CURDATE()');
    const [totalApps] = await pool.execute('SELECT COUNT(*) as count FROM aicp_job_applications');
    return {
      totalJobs: total[0].count,
      newToday: todayCount[0].count,
      totalApplications: totalApps[0].count,
      bySource: bySource.reduce((acc, r) => { acc[r.source] = r.count; return acc; }, {}),
      byCategory,
    };
  }

  async getAll({ page = 1, limit = 20, source, isActive } = {}) {
    let sql = 'SELECT * FROM aicp_aggregated_jobs WHERE 1=1';
    const params = [];
    if (source) { sql += ' AND source = ?'; params.push(source); }
    if (isActive !== undefined) { sql += ' AND is_active = ?'; params.push(isActive); }
    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
    const [countRows] = await pool.execute(countSql, params);
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(String(limit), String((page - 1) * limit));
    const [rows] = await pool.execute(sql, params);
    return { jobs: rows, total: countRows[0].total, page, totalPages: Math.ceil(countRows[0].total / limit) };
  }

  // ─── Applications ──────────────────────────────────────────

  async applyToJob(userId, jobId, resumeId, coverLetter) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_job_applications (user_id, job_id, resume_id, cover_letter) VALUES (?, ?, ?, ?)',
      [userId, jobId, resumeId || null, coverLetter || null]
    );
    return { id: result.insertId };
  }

  async getUserApplications(userId) {
    const [rows] = await pool.execute(
      `SELECT a.id, a.status, a.applied_at, a.user_id, a.job_id,
              j.title, j.company, j.location, j.source, j.apply_url
       FROM aicp_job_applications a
       JOIN aicp_aggregated_jobs j ON a.job_id = j.id
       WHERE a.user_id = ?

       UNION ALL

       SELECT aa.id, aa.stage AS status, aa.applied_at, aa.user_id, aa.job_id,
              aj.role_title AS title, aj.company_name AS company, aj.location, 'admin' AS source, NULL AS apply_url
       FROM aicp_admin_job_applications aa
       JOIN aicp_admin_jobs aj ON aa.job_id = aj.id
       WHERE aa.user_id = ?

       ORDER BY applied_at DESC`,
      [userId, userId]
    );
    return rows;
  }

  async hasApplied(userId, jobId) {
    const [rows] = await pool.execute(
      'SELECT id FROM aicp_job_applications WHERE user_id = ? AND job_id = ?',
      [userId, jobId]
    );
    return rows.length > 0;
  }

  async updateApplicationStatus(id, status) {
    await pool.execute('UPDATE aicp_job_applications SET status = ? WHERE id = ?', [status, id]);
  }

  // ─── Saved Jobs ────────────────────────────────────────────

  async saveJob(userId, jobId) {
    await pool.execute(
      'INSERT IGNORE INTO aicp_saved_jobs (user_id, job_id) VALUES (?, ?)',
      [userId, jobId]
    );
  }

  async unsaveJob(userId, jobId) {
    await pool.execute('DELETE FROM aicp_saved_jobs WHERE user_id = ? AND job_id = ?', [userId, jobId]);
  }

  async getSavedJobs(userId) {
    const [rows] = await pool.execute(
      `SELECT s.id as saved_id, s.saved_at, j.*
       FROM aicp_saved_jobs s
       JOIN aicp_aggregated_jobs j ON s.job_id = j.id
       WHERE s.user_id = ? AND j.is_active = 1 ORDER BY s.saved_at DESC`,
      [userId]
    );
    return rows;
  }

  async isSaved(userId, jobId) {
    const [rows] = await pool.execute('SELECT id FROM aicp_saved_jobs WHERE user_id = ? AND job_id = ?', [userId, jobId]);
    return rows.length > 0;
  }

  // ─── Related Jobs ─────────────────────────────────────────

  async getRelatedJobs(jobId, category, limit = 6) {
    const [rows] = await pool.execute(
      `SELECT id, title, company, location, salary_min, salary_max, experience_min, experience_max,
              job_type, work_mode, category, skills, company_logo, posted_date
       FROM aicp_aggregated_jobs
       WHERE is_active = 1 AND id != ? AND category = ?
       ORDER BY posted_date DESC
       LIMIT ?`,
      [jobId, category, String(limit)]
    );
    return rows;
  }

  // ─── Scraper Logs ──────────────────────────────────────────

  async createScraperLog(source) {
    const [result] = await pool.execute('INSERT INTO aicp_scraper_logs (source) VALUES (?)', [source]);
    return result.insertId;
  }

  async updateScraperLog(id, data) {
    await pool.execute(
      'UPDATE aicp_scraper_logs SET status = ?, jobs_found = ?, jobs_added = ?, jobs_updated = ?, error_message = ?, completed_at = NOW() WHERE id = ?',
      [data.status, data.jobsFound || 0, data.jobsAdded || 0, data.jobsUpdated || 0, data.errorMessage || null, id]
    );
  }

  async getScraperLogs(limit = 20) {
    const [rows] = await pool.execute('SELECT * FROM aicp_scraper_logs ORDER BY started_at DESC LIMIT ?', [String(limit)]);
    return rows;
  }

  // ─── Companies ─────────────────────────────────────────────

  async createCompany(data) {
    const [result] = await pool.execute(
      'INSERT INTO aicp_job_companies (name, logo, website, industry, description, is_verified, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [data.name, data.logo || null, data.website || null, data.industry || null, data.description || null, data.isVerified || 0, data.createdBy || null]
    );
    return { id: result.insertId, ...data };
  }

  async getCompanies() {
    const [rows] = await pool.execute('SELECT * FROM aicp_job_companies ORDER BY name');
    return rows;
  }
}

module.exports = new JobAggregatorRepository();
