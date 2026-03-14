const studentRepo = require('../repositories/studentMgmtRepo');
const ExcelJS = require('exceljs');

class StudentMgmtService {
  // ─── List with pagination + filters ──────────────────────
  async getStudents(query) {
    const filters = {
      page: parseInt(query.page) || 1,
      limit: parseInt(query.limit) || 25,
      search: query.search || null,
      program: query.program || null,
      branch: query.branch || null,
      graduationYear: query.graduation_year || null,
      placementStatus: query.placement_status || null,
      atsMin: query.ats_min != null ? query.ats_min : null,
      atsMax: query.ats_max != null ? query.ats_max : null,
      cgpaMin: query.cgpa_min != null ? query.cgpa_min : null,
      cgpaMax: query.cgpa_max != null ? query.cgpa_max : null,
      skills: query.skills ? (Array.isArray(query.skills) ? query.skills : query.skills.split(',')) : null,
      resumeUploaded: query.resume_uploaded || null,
      lastActive: query.last_active || null,
      sortBy: query.sort_by || 'created_at',
      sortDir: query.sort_dir || 'DESC',
    };

    const result = await studentRepo.findStudents(filters);

    result.students = result.students.map(s => {
      let skillsArr = [];
      try { skillsArr = s.skills_json ? (typeof s.skills_json === 'string' ? JSON.parse(s.skills_json) : s.skills_json) : []; }
      catch { skillsArr = []; }
      return { ...s, skills: skillsArr };
    });

    return {
      ...result,
      totalPages: Math.ceil(result.total / result.limit),
    };
  }

  // ─── Single student profile ──────────────────────────────
  async getStudentProfile(id) {
    const student = await studentRepo.findById(id);
    if (!student) return null;

    const [skills, projects, interviews, applications, completenessData] = await Promise.all([
      studentRepo.getSkills(id),
      studentRepo.getProjects(id),
      studentRepo.getInterviewHistory(id),
      studentRepo.getApplicationHistory(id),
      studentRepo.getCompletenessData(id),
    ]);

    const completeness = this._calcCompleteness(completenessData);

    return { ...student, skills, projects, interviews, applications, completeness };
  }

  // ─── Completeness score ──────────────────────────────────
  _calcCompleteness(d) {
    let score = 0;
    const breakdown = {};

    breakdown.resume = d.hasResume ? 25 : 0; score += breakdown.resume;
    breakdown.skills = d.hasSkills ? 15 : 0; score += breakdown.skills;
    breakdown.linkedin = d.hasLinkedin ? 10 : 0; score += breakdown.linkedin;
    breakdown.github = d.hasGithub ? 10 : 0; score += breakdown.github;
    breakdown.projects = d.hasProjects ? 15 : 0; score += breakdown.projects;
    breakdown.ats = d.atsScore >= 60 ? 15 : 0; score += breakdown.ats;
    breakdown.mockInterview = d.hasMockInterview ? 10 : 0; score += breakdown.mockInterview;

    return { score, breakdown };
  }

  // ─── Skills management ───────────────────────────────────
  async addSkill(userId, skillName, skillType) {
    await studentRepo.addSkill(userId, skillName, skillType, 'admin');
    return studentRepo.getSkills(userId);
  }

  async removeSkill(userId, skillId) {
    await studentRepo.removeSkill(userId, skillId);
    return studentRepo.getSkills(userId);
  }

  // ─── Filter options ──────────────────────────────────────
  async getFilterOptions() {
    const [programs, branches, gradYears, skills] = await Promise.all([
      studentRepo.getDistinctPrograms(),
      studentRepo.getDistinctBranches(),
      studentRepo.getDistinctGradYears(),
      studentRepo.getDistinctSkills(),
    ]);
    return { programs, branches, gradYears, skills };
  }

  // ─── Bulk actions ────────────────────────────────────────
  async bulkAction(action, userIds, payload) {
    if (!userIds || !userIds.length) throw new Error('No students selected');

    switch (action) {
      case 'change_status':
        await studentRepo.bulkUpdateStatus(userIds, payload.status);
        return { message: `Updated ${userIds.length} student(s) to ${payload.status}` };

      case 'export_csv':
        return this._exportStudents(userIds, payload.columns);

      case 'send_job_alert':
      case 'invite_interview':
      case 'send_resume_tips':
        // Return emails list — actual sending deferred to email service
        const students = await studentRepo.getStudentEmails(userIds);
        return { message: `Action "${action}" queued for ${students.length} student(s)`, students };

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // ─── Excel export ────────────────────────────────────────
  async exportStudents(query) {
    const filters = {
      page: 1, limit: 100000,
      search: query.search || null,
      program: query.program || null,
      branch: query.branch || null,
      graduationYear: query.graduation_year || null,
      placementStatus: query.placement_status || null,
      atsMin: query.ats_min != null ? query.ats_min : null,
      atsMax: query.ats_max != null ? query.ats_max : null,
      cgpaMin: query.cgpa_min != null ? query.cgpa_min : null,
      cgpaMax: query.cgpa_max != null ? query.cgpa_max : null,
      skills: query.skills ? (Array.isArray(query.skills) ? query.skills : query.skills.split(',')) : null,
      resumeUploaded: query.resume_uploaded || null,
      lastActive: query.last_active || null,
      sortBy: query.sort_by || 'created_at',
      sortDir: query.sort_dir || 'DESC',
    };

    const result = await studentRepo.findStudents(filters);
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Students');

    sheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Student ID', key: 'student_id', width: 15 },
      { header: 'Program', key: 'program', width: 20 },
      { header: 'Branch', key: 'branch', width: 20 },
      { header: 'Grad Year', key: 'graduation_year', width: 12 },
      { header: 'CGPA', key: 'cgpa', width: 8 },
      { header: 'ATS Score', key: 'ats_score', width: 12 },
      { header: 'Placement Status', key: 'placement_status', width: 18 },
      { header: 'Phone', key: 'phone', width: 15 },
      { header: 'Skills', key: 'skills', width: 40 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1B36' } };
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    result.students.forEach(s => {
      let skillsList = '';
      try {
        const arr = s.skills_json ? (typeof s.skills_json === 'string' ? JSON.parse(s.skills_json) : s.skills_json) : [];
        skillsList = arr.map(sk => sk.name).join(', ');
      } catch {}
      sheet.addRow({
        name: s.name, email: s.email, student_id: s.student_id || '',
        program: s.program || '', branch: s.branch || '',
        graduation_year: s.graduation_year || '', cgpa: s.cgpa || '',
        ats_score: s.ats_score, placement_status: s.placement_status || 'not_placed',
        phone: s.phone || '', skills: skillsList,
      });
    });

    return workbook;
  }
}

module.exports = new StudentMgmtService();
