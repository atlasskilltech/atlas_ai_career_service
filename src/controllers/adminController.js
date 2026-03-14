const dashboardService = require('../services/dashboardService');
const userRepository = require('../repositories/userRepository');
const pool = require('../config/database');

class AdminController {
  async index(req, res) {
    try {
      const data = await dashboardService.getAdminDashboard();
      const students = await userRepository.getAllStudents();
      res.render('pages/admin/index', {
        title: 'Placement Dashboard',
        layout: 'layouts/admin',
        ...data,
        students,
      });
    } catch (err) {
      req.flash('error', 'Failed to load admin dashboard');
      res.render('pages/admin/index', {
        title: 'Placement Dashboard',
        layout: 'layouts/admin',
        studentCount: 0,
        studentsByDept: [],
        scoreDistribution: [],
        avgResumeScore: 0,
        totalApplications: 0,
        interviewSuccessRate: 0,
        students: [],
      });
    }
  }

  async students(req, res) {
    try {
      const students = await userRepository.getAllStudents();
      res.render('pages/admin/students', { title: 'Students', layout: 'layouts/admin', students });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async jobs(req, res) {
    try {
      const [jobs] = await pool.execute(
        'SELECT id, title, company, location, job_type, work_mode, is_active, posted_date, created_at FROM aicp_aggregated_jobs ORDER BY created_at DESC LIMIT 100'
      );
      res.render('pages/admin/jobs', { title: 'Jobs Management', layout: 'layouts/admin', jobs });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async recruiters(req, res) {
    try {
      const [recruiters] = await pool.execute(
        `SELECT c.id, c.name, c.industry, c.is_verified, c.logo, c.website,
                COUNT(j.id) AS job_count
         FROM aicp_job_companies c
         LEFT JOIN aicp_aggregated_jobs j ON j.company = c.name AND j.is_active = 1
         GROUP BY c.id ORDER BY job_count DESC LIMIT 50`
      );
      res.render('pages/admin/recruiters', { title: 'Recruiters', layout: 'layouts/admin', recruiters });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async applications(req, res) {
    try {
      const [applications] = await pool.execute(
        `SELECT a.id, a.status, a.applied_at, u.name AS student, u.email, u.department,
                j.title AS job_title, j.company
         FROM aicp_job_applications a
         JOIN aicp_users u ON a.user_id = u.id
         JOIN aicp_aggregated_jobs j ON a.job_id = j.id

         UNION ALL

         SELECT aa.id, aa.stage AS status, aa.applied_at, u.name AS student, u.email, u.department,
                aj.role_title AS job_title, aj.company_name AS company
         FROM aicp_admin_job_applications aa
         JOIN aicp_users u ON aa.user_id = u.id
         JOIN aicp_admin_jobs aj ON aa.job_id = aj.id

         ORDER BY applied_at DESC LIMIT 100`
      );
      res.render('pages/admin/applications', { title: 'Applications', layout: 'layouts/admin', applications });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async interviews(req, res) {
    try {
      const [interviews] = await pool.execute(
        `SELECT i.id, i.job_role, i.company, i.interview_type, i.difficulty, i.status,
                i.started_at, i.completed_at, u.name AS student, u.department,
                r.overall_score
         FROM aicp_interviews i
         JOIN aicp_users u ON i.user_id = u.id
         LEFT JOIN aicp_interview_results r ON r.interview_id = i.id
         ORDER BY i.created_at DESC LIMIT 100`
      );
      res.render('pages/admin/interviews', { title: 'Interviews', layout: 'layouts/admin', interviews });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async skillGap(req, res) {
    try {
      const [analyses] = await pool.execute(
        `SELECT s.id, s.target_role, s.match_percentage, s.missing_skills, s.created_at,
                u.name AS student, u.department
         FROM aicp_skill_analyses s
         JOIN aicp_users u ON s.user_id = u.id
         ORDER BY s.created_at DESC LIMIT 100`
      );
      res.render('pages/admin/skill-gap', { title: 'Skill Gap Analysis', layout: 'layouts/admin', analyses });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async placement(req, res) {
    try {
      const [placements] = await pool.execute(
        `SELECT u.name AS student, u.department, j.company, j.title AS position,
                j.salary_max AS salary, a.applied_at AS placed_at
         FROM aicp_job_applications a
         JOIN aicp_users u ON a.user_id = u.id
         JOIN aicp_aggregated_jobs j ON a.job_id = j.id
         WHERE a.status = 'offered'
         ORDER BY a.applied_at DESC`
      );
      res.render('pages/admin/placement', { title: 'Placement Records', layout: 'layouts/admin', placements });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async communication(req, res) {
    try {
      const [contacts] = await pool.execute(
        `SELECT c.id, c.name, c.email, c.company, c.position, c.contact_type, c.last_contacted,
                u.name AS student_name
         FROM aicp_contacts c
         JOIN aicp_users u ON c.user_id = u.id
         ORDER BY c.updated_at DESC LIMIT 100`
      );
      res.render('pages/admin/communication', { title: 'Communication', layout: 'layouts/admin', contacts });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async settings(req, res) {
    res.render('pages/admin/settings', { title: 'Settings', layout: 'layouts/admin' });
  }

  async apiStats(req, res) {
    try {
      const data = await dashboardService.getAdminDashboard();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new AdminController();
