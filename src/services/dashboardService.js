const resumeRepository = require('../repositories/resumeRepository');
const jobRepository = require('../repositories/jobRepository');
const interviewRepository = require('../repositories/interviewRepository');
const skillAnalysisRepository = require('../repositories/skillAnalysisRepository');
const userRepository = require('../repositories/userRepository');

class DashboardService {
  async getStudentDashboard(userId) {
    const [resumes, jobStats, interviewScores, skillAnalyses] = await Promise.all([
      resumeRepository.findByUserId(userId),
      jobRepository.getCountByStatus(userId),
      interviewRepository.getAverageScores(userId),
      skillAnalysisRepository.findByUserId(userId),
    ]);

    const primaryResume = resumes.find(r => r.is_primary) || resumes[0];
    const resumeScore = primaryResume?.ats_score || 0;

    const statusMap = {};
    jobStats.forEach(s => { statusMap[s.status] = s.count; });

    const totalApplications = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const interviewInvitations = statusMap.interview || 0;

    const latestSkillAnalysis = skillAnalyses[0];
    const skillGaps = latestSkillAnalysis
      ? (typeof latestSkillAnalysis.missing_skills === 'string'
        ? JSON.parse(latestSkillAnalysis.missing_skills)
        : latestSkillAnalysis.missing_skills) || []
      : [];

    return {
      resumeScore,
      totalApplications,
      interviewInvitations,
      interviewReadiness: Math.round(interviewScores.avg_overall || 0),
      skillGaps: skillGaps.slice(0, 5),
      applicationBreakdown: statusMap,
      totalResumes: resumes.length,
    };
  }

  async getAdminDashboard() {
    const [studentCount, studentsByDept, scoreDistribution, avgResumeScore, totalApplications, interviewSuccessRate] = await Promise.all([
      userRepository.getStudentCount(),
      userRepository.getStudentsByDepartment(),
      resumeRepository.getScoreDistribution(),
      resumeRepository.getAverageScore(),
      jobRepository.getTotalApplications(),
      interviewRepository.getSuccessRate(),
    ]);

    return {
      studentCount,
      studentsByDept,
      scoreDistribution,
      avgResumeScore,
      totalApplications,
      interviewSuccessRate,
    };
  }
}

module.exports = new DashboardService();
