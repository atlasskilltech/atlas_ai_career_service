const pool = require('../config/database');

class SkillGapRepo {
  // ─── Compute demand (from active admin jobs' skills) ─────

  async computeDemand() {
    await pool.execute('DELETE FROM aicp_skill_demand');
    await pool.execute(`
      INSERT INTO aicp_skill_demand (skill_name, demand_count, supply_count, industry_sector, first_seen_at, computed_at)
      SELECT
        LOWER(TRIM(js.skill_name)) AS skill_name,
        COUNT(DISTINCT js.job_id) AS demand_count,
        COALESCE(sup.supply_count, 0) AS supply_count,
        NULL AS industry_sector,
        MIN(js.created_at) AS first_seen_at,
        NOW() AS computed_at
      FROM aicp_admin_job_skills js
      JOIN aicp_admin_jobs aj ON js.job_id = aj.id AND aj.status = 'active'
      LEFT JOIN (
        SELECT LOWER(TRIM(skill_name)) AS skill_name, COUNT(DISTINCT user_id) AS supply_count
        FROM aicp_student_skills
        GROUP BY LOWER(TRIM(skill_name))
      ) sup ON sup.skill_name = LOWER(TRIM(js.skill_name))
      GROUP BY LOWER(TRIM(js.skill_name))
      ON DUPLICATE KEY UPDATE
        demand_count = VALUES(demand_count),
        supply_count = VALUES(supply_count),
        computed_at = NOW()
    `);
  }

  // ─── Compute gap scores with optional department/program/year breakdown ───

  async computeGap(filters = {}) {
    await pool.execute('DELETE FROM aicp_skill_gap');

    let studentJoin = '';
    let studentWhere = '';
    const params = [];

    if (filters.department || filters.program || filters.graduation_year) {
      studentJoin = ' LEFT JOIN aicp_student_profiles sp ON ss.user_id = sp.user_id';
      if (filters.department) { studentWhere += ' AND sp.branch = ?'; params.push(filters.department); }
      if (filters.program) { studentWhere += ' AND sp.program = ?'; params.push(filters.program); }
      if (filters.graduation_year) { studentWhere += ' AND sp.graduation_year = ?'; params.push(filters.graduation_year); }
    }

    // Compute gap for each demanded skill
    const [demand] = await pool.execute('SELECT skill_name, demand_count FROM aicp_skill_demand');

    for (const d of demand) {
      const supSql = `SELECT COUNT(DISTINCT ss.user_id) AS cnt
        FROM aicp_student_skills ss ${studentJoin}
        WHERE LOWER(TRIM(ss.skill_name)) = ? ${studentWhere}`;
      const [supRows] = await pool.execute(supSql, [d.skill_name, ...params]);
      const supply = supRows[0].cnt;
      const gapScore = d.demand_count > 0 ? Math.round(((d.demand_count - supply) / d.demand_count) * 100) : 0;
      const clampedGap = Math.max(0, Math.min(100, gapScore));
      const priority = clampedGap > 70 ? 'critical' : clampedGap > 50 ? 'high' : clampedGap > 30 ? 'medium' : 'low';

      await pool.execute(`
        INSERT INTO aicp_skill_gap (skill_name, demand_count, supply_count, gap_score, priority, department, program, graduation_year, computed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE demand_count=VALUES(demand_count), supply_count=VALUES(supply_count),
          gap_score=VALUES(gap_score), priority=VALUES(priority), computed_at=NOW()
      `, [d.skill_name, d.demand_count, supply, clampedGap, priority,
          filters.department || null, filters.program || null, filters.graduation_year || null]);
    }
  }

  // ─── Summary stats ──────────────────────────────────────

  async getSummary() {
    const [rows] = await pool.execute(`
      SELECT
        COUNT(*) AS total_skills,
        SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) AS critical_gaps,
        ROUND(AVG(gap_score), 1) AS avg_gap,
        SUM(CASE WHEN first_seen >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS new_this_month
      FROM (
        SELECT sg.skill_name, sg.priority, sg.gap_score, sd.first_seen_at AS first_seen
        FROM aicp_skill_gap sg
        LEFT JOIN aicp_skill_demand sd ON sd.skill_name = sg.skill_name
      ) t
    `);
    return rows[0];
  }

  // ─── Top demanded skills ────────────────────────────────

  async getTopDemanded(limit = 10) {
    const [rows] = await pool.execute(
      'SELECT skill_name, demand_count, supply_count FROM aicp_skill_demand ORDER BY demand_count DESC LIMIT ?',
      [limit]
    );
    return rows;
  }

  // ─── Top skill gaps ────────────────────────────────────

  async getTopGaps(limit = 10, filters = {}) {
    let sql = 'SELECT skill_name, demand_count, supply_count, gap_score, priority FROM aicp_skill_gap WHERE 1=1';
    const params = [];
    if (filters.department) { sql += ' AND department = ?'; params.push(filters.department); }
    if (filters.program) { sql += ' AND program = ?'; params.push(filters.program); }
    if (filters.graduation_year) { sql += ' AND graduation_year = ?'; params.push(filters.graduation_year); }
    sql += ' ORDER BY gap_score DESC LIMIT ?';
    params.push(limit);
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  // ─── Demand vs Supply (grouped bar) ─────────────────────

  async getDemandVsSupply(limit = 15) {
    const [rows] = await pool.execute(
      'SELECT skill_name, demand_count, supply_count FROM aicp_skill_gap ORDER BY demand_count DESC LIMIT ?',
      [limit]
    );
    return rows;
  }

  // ─── Heatmap: department × skill ─────────────────────────

  async getHeatmapData() {
    const [rows] = await pool.execute(`
      SELECT
        COALESCE(sp.branch, 'Unknown') AS department,
        LOWER(TRIM(js.skill_name)) AS skill_name,
        COUNT(DISTINCT js.job_id) AS demand,
        COUNT(DISTINCT CASE WHEN ss.id IS NOT NULL THEN ss.user_id END) AS supply
      FROM aicp_admin_job_skills js
      JOIN aicp_admin_jobs aj ON js.job_id = aj.id AND aj.status = 'active'
      LEFT JOIN aicp_student_skills ss ON LOWER(TRIM(ss.skill_name)) = LOWER(TRIM(js.skill_name))
      LEFT JOIN aicp_student_profiles sp ON ss.user_id = sp.user_id
      GROUP BY department, LOWER(TRIM(js.skill_name))
      ORDER BY department, demand DESC
    `);
    return rows;
  }

  // ─── Emerging skills (first appeared < 30 days) ─────────

  async getEmergingSkills() {
    const [rows] = await pool.execute(`
      SELECT sd.skill_name, sd.demand_count, sd.supply_count, sd.first_seen_at,
        COALESCE(sg.gap_score, 0) AS gap_score, COALESCE(sg.priority, 'low') AS priority
      FROM aicp_skill_demand sd
      LEFT JOIN aicp_skill_gap sg ON sg.skill_name = sd.skill_name
      WHERE sd.first_seen_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      ORDER BY sd.demand_count DESC LIMIT 20
    `);
    return rows;
  }

  // ─── Trend data: month-over-month for top critical skills ─

  async getTrends(limit = 5) {
    // Get top critical skills
    const [topSkills] = await pool.execute(
      `SELECT DISTINCT skill_name FROM aicp_skill_gap WHERE priority = 'critical' ORDER BY gap_score DESC LIMIT ?`,
      [limit]
    );
    if (!topSkills.length) return { skills: [], months: [], data: {} };

    const skillNames = topSkills.map(r => r.skill_name);
    const data = {};

    // For each skill, compute monthly supply over last 6 months
    for (const skill of skillNames) {
      const [rows] = await pool.execute(`
        SELECT
          DATE_FORMAT(ss.created_at, '%Y-%m') AS month,
          COUNT(DISTINCT ss.user_id) AS supply
        FROM aicp_student_skills ss
        WHERE LOWER(TRIM(ss.skill_name)) = ?
          AND ss.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY month ORDER BY month
      `, [skill]);
      data[skill] = rows;
    }

    // Get demand per skill for gap calculation
    const demandMap = {};
    for (const skill of skillNames) {
      const [d] = await pool.execute('SELECT demand_count FROM aicp_skill_demand WHERE skill_name = ?', [skill]);
      demandMap[skill] = d[0] ? d[0].demand_count : 0;
    }

    // Build 6-month labels
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      months.push(d.toISOString().slice(0, 7));
    }

    // Build trend series: gap % per month per skill
    const series = {};
    for (const skill of skillNames) {
      const supplyByMonth = {};
      (data[skill] || []).forEach(r => { supplyByMonth[r.month] = r.supply; });
      const demand = demandMap[skill] || 1;
      series[skill] = months.map(m => {
        const supply = supplyByMonth[m] || 0;
        return Math.max(0, Math.round(((demand - supply) / demand) * 100));
      });
    }

    return { skills: skillNames, months, series };
  }

  // ─── All gaps (for export) ──────────────────────────────

  async getAllGaps(filters = {}) {
    let sql = `SELECT sg.skill_name, sg.demand_count, sg.supply_count, sg.gap_score, sg.priority,
      sg.department, sg.program, sg.graduation_year, sg.computed_at
      FROM aicp_skill_gap sg WHERE 1=1`;
    const params = [];
    if (filters.department) { sql += ' AND sg.department = ?'; params.push(filters.department); }
    if (filters.program) { sql += ' AND sg.program = ?'; params.push(filters.program); }
    if (filters.graduation_year) { sql += ' AND sg.graduation_year = ?'; params.push(filters.graduation_year); }
    sql += ' ORDER BY sg.gap_score DESC LIMIT 500';
    const [rows] = await pool.execute(sql, params);
    return rows;
  }

  // ─── Filter options ─────────────────────────────────────

  async getFilterOptions() {
    const [departments] = await pool.execute(
      'SELECT DISTINCT branch FROM aicp_student_profiles WHERE branch IS NOT NULL ORDER BY branch'
    );
    const [programs] = await pool.execute(
      'SELECT DISTINCT program FROM aicp_student_profiles WHERE program IS NOT NULL ORDER BY program'
    );
    const [years] = await pool.execute(
      'SELECT DISTINCT graduation_year FROM aicp_student_profiles WHERE graduation_year IS NOT NULL ORDER BY graduation_year DESC'
    );
    const [industries] = await pool.execute(
      `SELECT DISTINCT aj.company_name AS industry FROM aicp_admin_jobs aj WHERE aj.status = 'active' ORDER BY industry LIMIT 50`
    );
    return {
      departments: departments.map(r => r.branch),
      programs: programs.map(r => r.program),
      years: years.map(r => r.graduation_year),
      industries: industries.map(r => r.industry)
    };
  }

  // ─── Cache (for AI insights) ─────────────────────────────

  async getCache(key) {
    const [rows] = await pool.execute(
      'SELECT cache_value FROM aicp_skill_gap_cache WHERE cache_key = ? AND expires_at > NOW()',
      [key]
    );
    return rows[0] ? JSON.parse(rows[0].cache_value) : null;
  }

  async setCache(key, value, ttlHours = 24) {
    await pool.execute(
      `INSERT INTO aicp_skill_gap_cache (cache_key, cache_value, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))
       ON DUPLICATE KEY UPDATE cache_value = VALUES(cache_value), expires_at = VALUES(expires_at)`,
      [key, JSON.stringify(value), ttlHours]
    );
  }

  async clearCache() {
    await pool.execute('DELETE FROM aicp_skill_gap_cache');
  }
}

module.exports = new SkillGapRepo();
