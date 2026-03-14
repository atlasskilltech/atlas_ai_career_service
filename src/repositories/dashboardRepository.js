const pool = require('../config/database');

class DashboardRepository {
  // ─── KPI Metrics ───────────────────────────────────────────
  async getMetrics(academicYear) {
    const [rows] = await pool.execute(
      'SELECT metric_key, metric_value, previous_value FROM aicp_dashboard_metrics WHERE academic_year = ?',
      [academicYear]
    );
    return rows;
  }

  async upsertMetric(key, value, previousValue, academicYear) {
    await pool.execute(
      `INSERT INTO aicp_dashboard_metrics (metric_key, metric_value, previous_value, academic_year, computed_at)
       VALUES (?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE metric_value = VALUES(metric_value), previous_value = VALUES(previous_value), computed_at = NOW()`,
      [key, value, previousValue, academicYear]
    );
  }

  // ─── Source counts (for POST /refresh) ─────────────────────
  async getTotalStudents(academicYear) {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM aicp_users WHERE role = 'student'"
    );
    return rows[0].cnt;
  }

  async getCompletedProfiles() {
    const [rows] = await pool.execute(
      `SELECT COUNT(*) AS cnt FROM aicp_users u
       WHERE u.role = 'student' AND u.department IS NOT NULL AND u.phone IS NOT NULL`
    );
    return rows[0].cnt;
  }

  async getActiveJobs() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM aicp_aggregated_jobs WHERE is_active = 1'
    );
    return rows[0].cnt;
  }

  async getTotalApplications() {
    const [rows] = await pool.execute(
      'SELECT COUNT(*) AS cnt FROM aicp_job_applications'
    );
    return rows[0].cnt;
  }

  async getInterviewsScheduled() {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM aicp_job_applications WHERE status = 'interview'"
    );
    return rows[0].cnt;
  }

  async getOffersReceived() {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM aicp_job_applications WHERE status = 'offered'"
    );
    return rows[0].cnt;
  }

  async getStudentsPlaced() {
    const [rows] = await pool.execute(
      "SELECT COUNT(DISTINCT user_id) AS cnt FROM aicp_job_applications WHERE status = 'offered'"
    );
    return rows[0].cnt;
  }

  async getPlacementRate() {
    const [rows] = await pool.execute(
      `SELECT
         (SELECT COUNT(DISTINCT user_id) FROM aicp_job_applications WHERE status = 'offered') AS placed,
         (SELECT COUNT(*) FROM aicp_users WHERE role = 'student') AS total`
    );
    const { placed, total } = rows[0];
    return total > 0 ? Math.round((placed / total) * 100) : 0;
  }

  async getAvgSalary() {
    const [rows] = await pool.execute(
      `SELECT AVG(j.salary_max) AS avg_sal
       FROM aicp_job_applications a
       JOIN aicp_aggregated_jobs j ON a.job_id = j.id
       WHERE a.status = 'offered' AND j.salary_max IS NOT NULL`
    );
    return Math.round(rows[0].avg_sal || 0);
  }

  // ─── Previous month counts (for % change badges) ──────────
  async getTotalStudentsPrev() {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM aicp_users WHERE role = 'student' AND created_at < DATE_FORMAT(NOW(), '%Y-%m-01')"
    );
    return rows[0].cnt;
  }

  async getTotalApplicationsPrev() {
    const [rows] = await pool.execute(
      "SELECT COUNT(*) AS cnt FROM aicp_job_applications WHERE applied_at < DATE_FORMAT(NOW(), '%Y-%m-01')"
    );
    return rows[0].cnt;
  }

  // ─── Chart Data ────────────────────────────────────────────
  async getPlacementTrend(year) {
    const [currentYear] = await pool.execute(
      `SELECT MONTH(a.applied_at) AS m, COUNT(DISTINCT a.user_id) AS cnt
       FROM aicp_job_applications a WHERE a.status = 'offered' AND YEAR(a.applied_at) = ?
       GROUP BY MONTH(a.applied_at) ORDER BY m`,
      [year]
    );
    const [lastYear] = await pool.execute(
      `SELECT MONTH(a.applied_at) AS m, COUNT(DISTINCT a.user_id) AS cnt
       FROM aicp_job_applications a WHERE a.status = 'offered' AND YEAR(a.applied_at) = ?
       GROUP BY MONTH(a.applied_at) ORDER BY m`,
      [year - 1]
    );
    return { currentYear, lastYear };
  }

  async getApplicationFunnel() {
    const [rows] = await pool.execute(
      `SELECT status, COUNT(*) AS cnt FROM aicp_job_applications GROUP BY status ORDER BY FIELD(status, 'applied','reviewed','shortlisted','interview','offered')`
    );
    return rows;
  }

  async getJobsByIndustry() {
    const [rows] = await pool.execute(
      `SELECT COALESCE(c.industry, 'Other') AS industry, COUNT(*) AS cnt
       FROM aicp_aggregated_jobs j
       LEFT JOIN aicp_job_companies c ON j.company = c.name
       WHERE j.is_active = 1
       GROUP BY industry ORDER BY cnt DESC LIMIT 8`
    );
    return rows;
  }

  async getTopRecruiters() {
    const [rows] = await pool.execute(
      `SELECT j.company AS name, COUNT(DISTINCT a.user_id) AS hired
       FROM aicp_job_applications a
       JOIN aicp_aggregated_jobs j ON a.job_id = j.id
       WHERE a.status = 'offered'
       GROUP BY j.company ORDER BY hired DESC LIMIT 10`
    );
    return rows;
  }

  async getDepartmentPlacements() {
    const [rows] = await pool.execute(
      `SELECT COALESCE(u.department, 'Unknown') AS dept,
              COUNT(DISTINCT a.user_id) AS placed,
              (SELECT COUNT(*) FROM aicp_users u2 WHERE u2.role = 'student' AND u2.department = u.department) AS total
       FROM aicp_job_applications a
       JOIN aicp_users u ON a.user_id = u.id
       WHERE a.status = 'offered'
       GROUP BY u.department`
    );
    return rows;
  }

  async getSalaryDistribution() {
    const [rows] = await pool.execute(
      `SELECT
         CASE
           WHEN j.salary_max < 500000 THEN '0-5L'
           WHEN j.salary_max < 1000000 THEN '5-10L'
           WHEN j.salary_max < 1500000 THEN '10-15L'
           ELSE '15L+'
         END AS bucket,
         COUNT(*) AS cnt
       FROM aicp_job_applications a
       JOIN aicp_aggregated_jobs j ON a.job_id = j.id
       WHERE a.status = 'offered' AND j.salary_max IS NOT NULL
       GROUP BY bucket
       ORDER BY FIELD(bucket, '0-5L','5-10L','10-15L','15L+')`
    );
    return rows;
  }

  // ─── Activity Feed ─────────────────────────────────────────
  async getRecentJobs(limit = 5) {
    const [rows] = await pool.execute(
      'SELECT company, title AS role, posted_date AS created_at FROM aicp_aggregated_jobs WHERE is_active = 1 ORDER BY posted_date DESC LIMIT ?',
      [limit]
    );
    return rows;
  }

  async getLatestApplications(limit = 5) {
    const [rows] = await pool.execute(
      `SELECT u.name AS student, j.company, a.status, a.applied_at AS created_at
       FROM aicp_job_applications a
       JOIN aicp_users u ON a.user_id = u.id
       JOIN aicp_aggregated_jobs j ON a.job_id = j.id
       ORDER BY a.applied_at DESC LIMIT ?`,
      [limit]
    );
    return rows;
  }

  async getUpcomingInterviews(limit = 5) {
    const [rows] = await pool.execute(
      `SELECT u.name AS student, i.company, i.started_at AS interview_date
       FROM aicp_interviews i
       JOIN aicp_users u ON i.user_id = u.id
       WHERE i.status = 'setup' AND i.started_at >= NOW()
       ORDER BY i.started_at ASC LIMIT ?`,
      [limit]
    );
    return rows;
  }

  async getActivityLog(academicYear, limit = 5) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_activity_log WHERE academic_year = ? ORDER BY created_at DESC LIMIT ?',
      [academicYear, limit]
    );
    return rows;
  }

  // ─── Academic Years ────────────────────────────────────────
  async getAcademicYears() {
    const [rows] = await pool.execute(
      'SELECT DISTINCT academic_year FROM aicp_dashboard_metrics ORDER BY academic_year DESC'
    );
    const years = rows.map(r => r.academic_year);
    if (!years.length) years.push(this.currentAcademicYear());
    return years;
  }

  currentAcademicYear() {
    const now = new Date();
    const year = now.getMonth() >= 5 ? now.getFullYear() : now.getFullYear() - 1;
    return `${year}-${String(year + 1).slice(2)}`;
  }
}

module.exports = new DashboardRepository();
