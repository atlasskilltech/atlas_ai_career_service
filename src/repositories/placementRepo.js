const pool = require('../config/database');

class PlacementRepo {
  // ─── Build WHERE clause from filters ────────────────────

  _buildWhere(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.academic_year) {
      // Academic year like "2024-25" means offers from Jul 2024 to Jun 2025
      const startYear = parseInt(filters.academic_year.split('-')[0]);
      conditions.push('app.updated_at >= ? AND app.updated_at < ?');
      params.push(`${startYear}-07-01`, `${startYear + 1}-07-01`);
    }
    if (filters.program) {
      conditions.push('sp.program = ?');
      params.push(filters.program);
    }
    if (filters.branch) {
      conditions.push('sp.branch = ?');
      params.push(filters.branch);
    }
    if (filters.industry) {
      conditions.push('aj.company_name = ?');
      params.push(filters.industry);
    }
    return { where: conditions.length ? conditions.join(' AND ') : '1=1', params };
  }

  // ─── Top-level summary metrics ──────────────────────────

  async getSummary(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS total_placed,
        ROUND(AVG(aj.ctc_max), 0) AS avg_ctc,
        MAX(aj.ctc_max) AS highest_ctc,
        MIN(aj.ctc_max) AS lowest_ctc
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
    `, params);

    // Get total eligible students
    const eligibleParams = [];
    let eligibleWhere = '1=1';
    if (filters.program) { eligibleWhere += ' AND sp.program = ?'; eligibleParams.push(filters.program); }
    if (filters.branch) { eligibleWhere += ' AND sp.branch = ?'; eligibleParams.push(filters.branch); }
    if (filters.academic_year) {
      const startYear = parseInt(filters.academic_year.split('-')[0]);
      eligibleWhere += ' AND sp.graduation_year IN (?, ?)';
      eligibleParams.push(startYear, startYear + 1);
    }

    const [eligibleRows] = await pool.execute(`
      SELECT COUNT(*) AS total_eligible
      FROM aicp_student_profiles sp
      WHERE sp.placement_status != 'higher_studies' AND sp.placement_status != 'opted_out'
        AND ${eligibleWhere}
    `, eligibleParams);

    // Median CTC
    const [ctcRows] = await pool.execute(`
      SELECT aj.ctc_max AS ctc
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND aj.ctc_max IS NOT NULL AND ${where}
      ORDER BY aj.ctc_max
    `, params);

    const ctcValues = ctcRows.map(r => r.ctc);
    const medianCtc = ctcValues.length
      ? ctcValues.length % 2 === 0
        ? (ctcValues[ctcValues.length / 2 - 1] + ctcValues[ctcValues.length / 2]) / 2
        : ctcValues[Math.floor(ctcValues.length / 2)]
      : 0;

    const totalEligible = eligibleRows[0].total_eligible || 0;
    const totalPlaced = rows[0].total_placed || 0;
    const placementPct = totalEligible > 0 ? Math.round((totalPlaced / totalEligible) * 100 * 10) / 10 : 0;

    return {
      total_placed: totalPlaced,
      placement_pct: placementPct,
      avg_ctc: Math.round(rows[0].avg_ctc || 0),
      highest_ctc: rows[0].highest_ctc || 0,
      median_ctc: Math.round(medianCtc),
      unplaced_count: Math.max(0, totalEligible - totalPlaced),
      total_eligible: totalEligible
    };
  }

  // ─── Year-over-Year trends ──────────────────────────────

  async getYearOverYear() {
    const [rows] = await pool.execute(`
      SELECT
        CONCAT(CASE WHEN MONTH(app.updated_at) >= 7 THEN YEAR(app.updated_at) ELSE YEAR(app.updated_at)-1 END,
               '-', RIGHT(CASE WHEN MONTH(app.updated_at) >= 7 THEN YEAR(app.updated_at)+1 ELSE YEAR(app.updated_at) END, 2)
        ) AS academic_year,
        COUNT(*) AS total_placed,
        ROUND(AVG(aj.ctc_max), 0) AS avg_ctc
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      WHERE app.stage = 'offered'
      GROUP BY academic_year
      ORDER BY academic_year
    `);
    return rows;
  }

  // ─── Program-wise breakdown ─────────────────────────────

  async getProgramBreakdown(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        COALESCE(sp.program, 'Unknown') AS program,
        COUNT(CASE WHEN app.stage = 'offered' THEN 1 END) AS placed,
        COUNT(DISTINCT sp2.user_id) AS eligible,
        ROUND(AVG(CASE WHEN app.stage = 'offered' THEN aj.ctc_max END), 0) AS avg_ctc
      FROM aicp_student_profiles sp2
      LEFT JOIN aicp_admin_job_applications app ON sp2.user_id = app.user_id AND app.stage = 'offered'
      LEFT JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE sp2.placement_status NOT IN ('higher_studies','opted_out')
        AND (app.id IS NULL OR (${where}))
      GROUP BY COALESCE(sp2.program, 'Unknown')
      ORDER BY placed DESC
    `, params);

    return rows.map(r => ({
      ...r,
      pct: r.eligible > 0 ? Math.round((r.placed / r.eligible) * 100 * 10) / 10 : 0
    }));
  }

  // ─── Branch-wise breakdown ──────────────────────────────

  async getBranchBreakdown(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        COALESCE(sp.branch, 'Unknown') AS branch,
        COUNT(*) AS placed,
        ROUND(AVG(aj.ctc_max), 0) AS avg_ctc
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
      GROUP BY branch
      ORDER BY placed DESC
    `, params);
    return rows;
  }

  // ─── Industry/Company distribution ──────────────────────

  async getIndustryDistribution(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        aj.company_name AS industry,
        COUNT(*) AS count
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
      GROUP BY aj.company_name
      ORDER BY count DESC
      LIMIT 12
    `, params);
    return rows;
  }

  // ─── Salary distribution buckets ────────────────────────

  async getSalaryDistribution(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        CASE
          WHEN aj.ctc_max IS NULL THEN 'Undisclosed'
          WHEN aj.ctc_max < 500000 THEN '0-5L'
          WHEN aj.ctc_max < 1000000 THEN '5-10L'
          WHEN aj.ctc_max < 1500000 THEN '10-15L'
          WHEN aj.ctc_max < 2000000 THEN '15-20L'
          WHEN aj.ctc_max < 2500000 THEN '20-25L'
          ELSE '25L+'
        END AS bucket,
        COUNT(*) AS count
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
      GROUP BY bucket
      ORDER BY FIELD(bucket, '0-5L','5-10L','10-15L','15-20L','20-25L','25L+','Undisclosed')
    `, params);
    return rows;
  }

  // ─── Month-wise placements ──────────────────────────────

  async getMonthWise(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        DATE_FORMAT(app.updated_at, '%Y-%m') AS month,
        COUNT(*) AS count
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
      GROUP BY month
      ORDER BY month
    `, params);
    return rows;
  }

  // ─── Top companies ─────────────────────────────────────

  async getTopCompanies(filters = {}, limit = 15) {
    const { where, params } = this._buildWhere(filters);
    params.push(limit);
    const [rows] = await pool.execute(`
      SELECT
        aj.company_name AS company,
        COUNT(*) AS hired,
        ROUND(AVG(aj.ctc_max), 0) AS avg_ctc,
        MAX(aj.ctc_max) AS highest_ctc
      FROM aicp_admin_job_applications app
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
      GROUP BY aj.company_name
      ORDER BY hired DESC
      LIMIT ?
    `, params);
    return rows;
  }

  // ─── Batch tracker (per graduation year) ────────────────

  async getBatchTracker() {
    const [rows] = await pool.execute(`
      SELECT
        sp.graduation_year,
        COUNT(DISTINCT sp.user_id) AS total_eligible,
        COUNT(DISTINCT CASE WHEN app.stage = 'offered' THEN app.user_id END) AS placed
      FROM aicp_student_profiles sp
      LEFT JOIN aicp_admin_job_applications app ON sp.user_id = app.user_id AND app.stage = 'offered'
      WHERE sp.placement_status NOT IN ('higher_studies','opted_out')
        AND sp.graduation_year IS NOT NULL
      GROUP BY sp.graduation_year
      ORDER BY sp.graduation_year DESC
    `);
    return rows.map(r => ({
      ...r,
      pct: r.total_eligible > 0 ? Math.round((r.placed / r.total_eligible) * 100 * 10) / 10 : 0
    }));
  }

  // ─── Filter options ─────────────────────────────────────

  async getFilterOptions() {
    const [programs] = await pool.execute(
      'SELECT DISTINCT program FROM aicp_student_profiles WHERE program IS NOT NULL ORDER BY program'
    );
    const [branches] = await pool.execute(
      'SELECT DISTINCT branch FROM aicp_student_profiles WHERE branch IS NOT NULL ORDER BY branch'
    );
    const [companies] = await pool.execute(
      `SELECT DISTINCT aj.company_name FROM aicp_admin_jobs aj
       JOIN aicp_admin_job_applications app ON aj.id = app.job_id AND app.stage = 'offered'
       ORDER BY aj.company_name`
    );

    // Generate academic years from data
    const [years] = await pool.execute(`
      SELECT DISTINCT
        CONCAT(CASE WHEN MONTH(app.updated_at) >= 7 THEN YEAR(app.updated_at) ELSE YEAR(app.updated_at)-1 END,
               '-', RIGHT(CASE WHEN MONTH(app.updated_at) >= 7 THEN YEAR(app.updated_at)+1 ELSE YEAR(app.updated_at) END, 2)
        ) AS academic_year
      FROM aicp_admin_job_applications app WHERE app.stage = 'offered'
      ORDER BY academic_year DESC
    `);

    return {
      programs: programs.map(r => r.program),
      branches: branches.map(r => r.branch),
      industries: companies.map(r => r.company_name),
      academic_years: years.map(r => r.academic_year)
    };
  }

  // ─── Full placement records (for export) ────────────────

  async getAllPlacements(filters = {}) {
    const { where, params } = this._buildWhere(filters);
    const [rows] = await pool.execute(`
      SELECT
        u.name AS student_name,
        u.email,
        COALESCE(sp.program, '-') AS program,
        COALESCE(sp.branch, '-') AS branch,
        sp.graduation_year,
        aj.company_name,
        aj.role_title,
        aj.job_type,
        aj.ctc_min,
        aj.ctc_max,
        aj.location,
        aj.work_mode,
        app.updated_at AS placed_at
      FROM aicp_admin_job_applications app
      JOIN aicp_users u ON app.user_id = u.id
      JOIN aicp_admin_jobs aj ON app.job_id = aj.id
      LEFT JOIN aicp_student_profiles sp ON app.user_id = sp.user_id
      WHERE app.stage = 'offered' AND ${where}
      ORDER BY app.updated_at DESC
    `, params);
    return rows;
  }
}

module.exports = new PlacementRepo();
