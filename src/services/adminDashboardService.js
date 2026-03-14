const dashboardRepo = require('../repositories/dashboardRepository');

class AdminDashboardService {
  // ─── Fetch all KPIs (cached or live) ───────────────────────
  async getMetrics(academicYear) {
    const cached = await dashboardRepo.getMetrics(academicYear);
    if (cached.length > 0) {
      const map = {};
      cached.forEach(r => {
        map[r.metric_key] = {
          value: Number(r.metric_value),
          previous: Number(r.previous_value),
        };
      });
      return this._buildKpiResponse(map);
    }
    // Fallback: compute live
    return this.refreshMetrics(academicYear);
  }

  // ─── Re-compute from source tables ─────────────────────────
  async refreshMetrics(academicYear) {
    const [
      totalStudents, completedProfiles, activeJobs, totalApplications,
      interviewsScheduled, offersReceived, studentsPlaced, placementRate, avgSalary,
      totalStudentsPrev, totalApplicationsPrev,
    ] = await Promise.all([
      dashboardRepo.getTotalStudents(),
      dashboardRepo.getCompletedProfiles(),
      dashboardRepo.getActiveJobs(),
      dashboardRepo.getTotalApplications(),
      dashboardRepo.getInterviewsScheduled(),
      dashboardRepo.getOffersReceived(),
      dashboardRepo.getStudentsPlaced(),
      dashboardRepo.getPlacementRate(),
      dashboardRepo.getAvgSalary(),
      dashboardRepo.getTotalStudentsPrev(),
      dashboardRepo.getTotalApplicationsPrev(),
    ]);

    const metrics = {
      total_students: { value: totalStudents, previous: totalStudentsPrev },
      completed_profiles: { value: completedProfiles, previous: 0 },
      active_jobs: { value: activeJobs, previous: 0 },
      total_applications: { value: totalApplications, previous: totalApplicationsPrev },
      interviews_scheduled: { value: interviewsScheduled, previous: 0 },
      offers_received: { value: offersReceived, previous: 0 },
      students_placed: { value: studentsPlaced, previous: 0 },
      placement_rate: { value: placementRate, previous: 0 },
      avg_salary: { value: avgSalary, previous: 0 },
    };

    // Persist to cache
    const upserts = Object.entries(metrics).map(([key, { value, previous }]) =>
      dashboardRepo.upsertMetric(key, value, previous, academicYear)
    );
    await Promise.all(upserts);

    return this._buildKpiResponse(metrics);
  }

  _buildKpiResponse(map) {
    const kpi = (key, label, prefix = '', suffix = '') => {
      const m = map[key] || { value: 0, previous: 0 };
      const change = m.previous > 0
        ? Math.round(((m.value - m.previous) / m.previous) * 100)
        : 0;
      return { key, label, value: m.value, previous: m.previous, change, prefix, suffix };
    };

    return [
      kpi('total_students', 'Total Students'),
      kpi('completed_profiles', 'Completed Profiles'),
      kpi('active_jobs', 'Active Jobs'),
      kpi('total_applications', 'Total Applications'),
      kpi('interviews_scheduled', 'Interviews Scheduled'),
      kpi('offers_received', 'Offers Received'),
      kpi('students_placed', 'Students Placed'),
      kpi('placement_rate', 'Placement Rate', '', '%'),
      kpi('avg_salary', 'Avg Salary', '₹'),
    ];
  }

  // ─── Charts ────────────────────────────────────────────────
  async getCharts(academicYear) {
    const year = this._yearFromAcademic(academicYear);
    const [trend, funnel, industries, recruiters, departments, salaryDist] = await Promise.all([
      dashboardRepo.getPlacementTrend(year),
      dashboardRepo.getApplicationFunnel(),
      dashboardRepo.getJobsByIndustry(),
      dashboardRepo.getTopRecruiters(),
      dashboardRepo.getDepartmentPlacements(),
      dashboardRepo.getSalaryDistribution(),
    ]);
    return { trend, funnel, industries, recruiters, departments, salaryDist };
  }

  async getTrend(academicYear) {
    const year = this._yearFromAcademic(academicYear);
    return dashboardRepo.getPlacementTrend(year);
  }

  async getFunnel() {
    return dashboardRepo.getApplicationFunnel();
  }

  // ─── Activity Feeds ────────────────────────────────────────
  async getActivity(academicYear) {
    const [recentJobs, latestApps, upcomingInterviews] = await Promise.all([
      dashboardRepo.getRecentJobs(5),
      dashboardRepo.getLatestApplications(5),
      dashboardRepo.getUpcomingInterviews(5),
    ]);
    return { recentJobs, latestApps, upcomingInterviews };
  }

  // ─── Helpers ───────────────────────────────────────────────
  _yearFromAcademic(ay) {
    // '2025-26' → 2026
    const parts = ay.split('-');
    return parts.length === 2 ? 2000 + parseInt(parts[1]) : new Date().getFullYear();
  }

  getDefaultAcademicYear() {
    return dashboardRepo.currentAcademicYear();
  }

  async getAcademicYears() {
    return dashboardRepo.getAcademicYears();
  }
}

module.exports = new AdminDashboardService();
