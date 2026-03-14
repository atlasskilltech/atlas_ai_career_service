const adminDashboardService = require('../services/adminDashboardService');

class AdminDashboardController {
  async index(req, res) {
    try {
      const academicYear = req.query.year || adminDashboardService.getDefaultAcademicYear();
      const [metrics, charts, activity, academicYears] = await Promise.all([
        adminDashboardService.getMetrics(academicYear),
        adminDashboardService.getCharts(academicYear),
        adminDashboardService.getActivity(academicYear),
        adminDashboardService.getAcademicYears(),
      ]);

      res.render('pages/admin/dashboard', {
        title: 'Admin Dashboard',
        layout: 'layouts/admin',
        metrics,
        charts,
        activity,
        academicYears,
        selectedYear: academicYear,
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      req.flash('error', 'Failed to load dashboard');
      res.render('pages/admin/dashboard', {
        title: 'Admin Dashboard',
        layout: 'layouts/admin',
        metrics: [],
        charts: { trend: {}, funnel: [], industries: [], recruiters: [], departments: [], salaryDist: [] },
        activity: { recentJobs: [], latestApps: [], upcomingInterviews: [], recruiterFollowUps: [] },
        academicYears: [adminDashboardService.getDefaultAcademicYear()],
        selectedYear: adminDashboardService.getDefaultAcademicYear(),
      });
    }
  }

  // ─── JSON APIs ─────────────────────────────────────────────
  async apiMetrics(req, res) {
    try {
      const ay = req.query.year || adminDashboardService.getDefaultAcademicYear();
      const data = await adminDashboardService.getMetrics(ay);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async apiCharts(req, res) {
    try {
      const ay = req.query.year || adminDashboardService.getDefaultAcademicYear();
      const data = await adminDashboardService.getCharts(ay);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async apiActivity(req, res) {
    try {
      const ay = req.query.year || adminDashboardService.getDefaultAcademicYear();
      const data = await adminDashboardService.getActivity(ay);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async apiTrend(req, res) {
    try {
      const ay = req.query.year || adminDashboardService.getDefaultAcademicYear();
      const data = await adminDashboardService.getTrend(ay);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async apiFunnel(req, res) {
    try {
      const data = await adminDashboardService.getFunnel();
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async postRefresh(req, res) {
    try {
      const ay = req.query.year || adminDashboardService.getDefaultAcademicYear();
      const data = await adminDashboardService.refreshMetrics(ay);
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new AdminDashboardController();
