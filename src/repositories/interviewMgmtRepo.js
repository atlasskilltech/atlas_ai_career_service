const pool = require('../config/database');

class InterviewMgmtRepo {
  // ─── Create ─────────────────────────────────────────────
  async create(data) {
    const [result] = await pool.execute(
      `INSERT INTO aicp_admin_interviews
        (job_id, application_id, student_id, recruiter_id, interview_type, round_number,
         round_name, scheduled_date, scheduled_time, duration_minutes, timezone,
         mode, meet_link, venue, status, notes, feedback_token, feedback_token_expires, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.job_id, data.application_id || null, data.student_id,
        data.recruiter_id || null, data.interview_type || 'technical',
        data.round_number || 1, data.round_name || null,
        data.scheduled_date, data.scheduled_time,
        data.duration_minutes || 60, data.timezone || 'Asia/Kolkata',
        data.mode || 'online', data.meet_link || null, data.venue || null,
        data.status || 'scheduled', data.notes || null,
        data.feedback_token || null, data.feedback_token_expires || null,
        data.created_by || null,
      ]
    );
    return result.insertId;
  }

  // ─── Find by ID ─────────────────────────────────────────
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT i.*,
              j.role_title, j.company_name, j.company_logo,
              u.name AS student_name, u.email AS student_email, u.department AS student_department,
              sp.program AS student_program, sp.branch AS student_branch, sp.cgpa AS student_cgpa,
              r.company_name AS recruiter_company, r.contact_name AS recruiter_contact,
              r.contact_email AS recruiter_email
       FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id
       JOIN aicp_users u ON i.student_id = u.id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       LEFT JOIN aicp_recruiters r ON i.recruiter_id = r.id
       WHERE i.id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  // ─── Find by feedback token ─────────────────────────────
  async findByFeedbackToken(token) {
    const [rows] = await pool.execute(
      `SELECT i.*,
              j.role_title, j.company_name, j.company_logo,
              u.name AS student_name, u.email AS student_email,
              sp.program AS student_program, sp.branch AS student_branch, sp.cgpa AS student_cgpa
       FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id
       JOIN aicp_users u ON i.student_id = u.id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       WHERE i.feedback_token = ? AND i.feedback_token_expires > NOW()`,
      [token]
    );
    return rows[0] || null;
  }

  // ─── List with filters ─────────────────────────────────
  async findAll(filters = {}) {
    let where = ['1=1'];
    let params = [];

    if (filters.job_id) {
      where.push('i.job_id = ?');
      params.push(filters.job_id);
    }
    if (filters.student_id) {
      where.push('i.student_id = ?');
      params.push(filters.student_id);
    }
    if (filters.status) {
      where.push('i.status = ?');
      params.push(filters.status);
    }
    if (filters.interview_type) {
      where.push('i.interview_type = ?');
      params.push(filters.interview_type);
    }
    if (filters.mode) {
      where.push('i.mode = ?');
      params.push(filters.mode);
    }
    if (filters.date_from) {
      where.push('i.scheduled_date >= ?');
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      where.push('i.scheduled_date <= ?');
      params.push(filters.date_to);
    }
    if (filters.company) {
      where.push('j.company_name LIKE ?');
      params.push(`%${filters.company}%`);
    }
    if (filters.search) {
      where.push('(u.name LIKE ? OR j.company_name LIKE ? OR j.role_title LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    const sortMap = {
      newest: 'i.scheduled_date DESC, i.scheduled_time DESC',
      oldest: 'i.scheduled_date ASC, i.scheduled_time ASC',
      company: 'j.company_name ASC',
      student: 'u.name ASC',
      status: 'i.status ASC',
    };
    const orderBy = sortMap[filters.sort] || sortMap.newest;

    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const offset = (page - 1) * limit;

    const [rows] = await pool.execute(
      `SELECT i.*,
              j.role_title, j.company_name, j.company_logo,
              u.name AS student_name, u.email AS student_email,
              sp.program AS student_program,
              r.contact_name AS recruiter_contact
       FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id
       JOIN aicp_users u ON i.student_id = u.id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       LEFT JOIN aicp_recruiters r ON i.recruiter_id = r.id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id
       JOIN aicp_users u ON i.student_id = u.id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       LEFT JOIN aicp_recruiters r ON i.recruiter_id = r.id
       WHERE ${where.join(' AND ')}`,
      params
    );

    return { interviews: rows, total: countResult[0].total, page, limit };
  }

  // ─── Calendar events ───────────────────────────────────
  async findForCalendar(startDate, endDate) {
    const [rows] = await pool.execute(
      `SELECT i.id, i.scheduled_date, i.scheduled_time, i.duration_minutes,
              i.status, i.interview_type, i.mode, i.round_number,
              j.role_title, j.company_name,
              u.name AS student_name
       FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id
       JOIN aicp_users u ON i.student_id = u.id
       WHERE i.scheduled_date BETWEEN ? AND ?
       ORDER BY i.scheduled_date ASC, i.scheduled_time ASC`,
      [startDate, endDate]
    );
    return rows;
  }

  // ─── Stats ─────────────────────────────────────────────
  async getStats() {
    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(status = 'scheduled') AS scheduled,
        SUM(status = 'confirmed') AS confirmed,
        SUM(status = 'completed') AS completed,
        SUM(status = 'cancelled') AS cancelled,
        SUM(status = 'no_show') AS no_show,
        SUM(status = 'rescheduled') AS rescheduled,
        SUM(CASE WHEN scheduled_date = CURDATE() THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN scheduled_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS this_week,
        AVG(CASE WHEN overall_score IS NOT NULL THEN overall_score ELSE NULL END) AS avg_score
       FROM aicp_admin_interviews`
    );
    return rows[0];
  }

  // ─── Update ─────────────────────────────────────────────
  async update(id, data) {
    const fields = [];
    const values = [];
    const allowed = [
      'interview_type', 'round_number', 'round_name', 'scheduled_date',
      'scheduled_time', 'duration_minutes', 'timezone', 'mode', 'meet_link',
      'venue', 'status', 'cancellation_reason', 'notes',
      'feedback_submitted', 'feedback_token', 'feedback_token_expires',
      'technical_score', 'communication_score', 'problem_solving_score',
      'culture_fit_score', 'overall_score', 'recommendation',
      'feedback_comments', 'ai_feedback_summary',
    ];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(data[key]);
      }
    }
    if (!fields.length) return;
    values.push(id);
    await pool.execute(`UPDATE aicp_admin_interviews SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  // ─── Update status ─────────────────────────────────────
  async updateStatus(id, status, reason) {
    const params = [status];
    let extra = '';
    if (reason) {
      extra = ', cancellation_reason = ?';
      params.push(reason);
    }
    params.push(id);
    await pool.execute(`UPDATE aicp_admin_interviews SET status = ?${extra} WHERE id = ?`, params);
  }

  // ─── Save feedback criteria ─────────────────────────────
  async saveFeedbackCriteria(interviewId, criteria) {
    await pool.execute('DELETE FROM aicp_interview_feedback_criteria WHERE interview_id = ?', [interviewId]);
    for (const c of criteria) {
      await pool.execute(
        `INSERT INTO aicp_interview_feedback_criteria (interview_id, criteria_name, rating, comments)
         VALUES (?, ?, ?, ?)`,
        [interviewId, c.name, c.rating, c.comments || null]
      );
    }
  }

  // ─── Get feedback criteria ──────────────────────────────
  async getFeedbackCriteria(interviewId) {
    const [rows] = await pool.execute(
      'SELECT * FROM aicp_interview_feedback_criteria WHERE interview_id = ? ORDER BY id',
      [interviewId]
    );
    return rows;
  }

  // ─── Log notification ──────────────────────────────────
  async logNotification(data) {
    await pool.execute(
      `INSERT INTO aicp_interview_notifications
        (interview_id, notification_type, recipient_email, recipient_type, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [data.interview_id, data.notification_type, data.recipient_email,
       data.recipient_type || 'student', data.status || 'sent', data.error_message || null]
    );
  }

  // ─── Get active jobs for dropdown ──────────────────────
  async getActiveJobs() {
    const [rows] = await pool.execute(
      `SELECT id, role_title, company_name FROM aicp_admin_jobs WHERE status = 'active' ORDER BY company_name`
    );
    return rows;
  }

  // ─── Get shortlisted students for a job ────────────────
  async getShortlistedStudents(jobId) {
    const [rows] = await pool.execute(
      `SELECT a.id AS application_id, a.user_id, u.name, u.email,
              sp.program, sp.branch, sp.cgpa
       FROM aicp_admin_job_applications a
       JOIN aicp_users u ON a.user_id = u.id
       LEFT JOIN aicp_student_profiles sp ON sp.user_id = u.id
       WHERE a.job_id = ? AND a.stage IN ('shortlisted', 'interview')
       ORDER BY u.name`,
      [jobId]
    );
    return rows;
  }

  // ─── Get recruiters for dropdown ───────────────────────
  async getRecruiters() {
    const [rows] = await pool.execute(
      `SELECT id, company_name, contact_name, contact_email FROM aicp_recruiters ORDER BY company_name`
    );
    return rows;
  }

  // ─── Get upcoming interviews for reminders ─────────────
  async getUpcomingForReminders(hoursAhead) {
    const [rows] = await pool.execute(
      `SELECT i.*, j.role_title, j.company_name,
              u.name AS student_name, u.email AS student_email,
              r.contact_email AS recruiter_email, r.contact_name AS recruiter_contact
       FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id
       JOIN aicp_users u ON i.student_id = u.id
       LEFT JOIN aicp_recruiters r ON i.recruiter_id = r.id
       WHERE i.status IN ('scheduled', 'confirmed')
         AND CONCAT(i.scheduled_date, ' ', i.scheduled_time) BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL ? HOUR)
         AND NOT EXISTS (
           SELECT 1 FROM aicp_interview_notifications n
           WHERE n.interview_id = i.id
             AND n.notification_type = ?
             AND n.status = 'sent'
         )`,
      [hoursAhead, hoursAhead === 24 ? 'reminder_24h' : 'reminder_1h']
    );
    return rows;
  }

  // ─── Delete ─────────────────────────────────────────────
  async delete(id) {
    await pool.execute('DELETE FROM aicp_admin_interviews WHERE id = ?', [id]);
  }

  // ─── Get filter options ─────────────────────────────────
  async getFilterOptions() {
    const [companies] = await pool.execute(
      `SELECT DISTINCT j.company_name FROM aicp_admin_interviews i
       JOIN aicp_admin_jobs j ON i.job_id = j.id ORDER BY j.company_name`
    );
    const [students] = await pool.execute(
      `SELECT DISTINCT u.id, u.name FROM aicp_admin_interviews i
       JOIN aicp_users u ON i.student_id = u.id ORDER BY u.name`
    );
    return {
      companies: companies.map(r => r.company_name),
      students: students,
    };
  }
}

module.exports = new InterviewMgmtRepo();
