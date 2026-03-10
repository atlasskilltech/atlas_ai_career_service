const dashboardService = require('../services/dashboardService');

class DashboardController {
  async getStudentDashboard(req, res) {
    try {
      const data = await dashboardService.getStudentDashboard(req.session.user.id);
      res.render('pages/dashboard/index', {
        title: 'Career Dashboard',
        layout: 'layouts/app',
        ...data,
      });
    } catch (err) {
      req.flash('error', 'Failed to load dashboard');
      res.render('pages/dashboard/index', {
        title: 'Career Dashboard',
        layout: 'layouts/app',
        resumeScore: 0,
        totalApplications: 0,
        interviewInvitations: 0,
        interviewReadiness: 0,
        skillGaps: [],
        applicationBreakdown: {},
        totalResumes: 0,
      });
    }
  }
}

module.exports = new DashboardController();
