const dashboardService = require('../services/dashboardService');
const userRepository = require('../repositories/userRepository');

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
