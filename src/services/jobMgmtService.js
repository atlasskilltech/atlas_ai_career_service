const repo = require('../repositories/jobMgmtRepo');

class JobMgmtService {
  // ─── Job CRUD ───────────────────────────────────────────

  async createJob(data, userId) {
    data.created_by = userId;
    const jobId = await repo.createJob(data);

    if (data.skills && data.skills.length) {
      await repo.setJobSkills(jobId, data.skills);
    }
    if (data.rounds && data.rounds.length) {
      await repo.setJobRounds(jobId, data.rounds);
    }
    return jobId;
  }

  async updateJob(id, data) {
    await repo.updateJob(id, data);

    if (data.skills !== undefined) {
      await repo.setJobSkills(id, data.skills || []);
    }
    if (data.rounds !== undefined) {
      await repo.setJobRounds(id, data.rounds || []);
    }
  }

  async updateStatus(id, status) {
    await repo.updateStatus(id, status);
  }

  async deleteJob(id) {
    await repo.deleteJob(id);
  }

  async getJobById(id) {
    const job = await repo.findById(id);
    if (!job) throw new Error('Job not found');

    const [skills, rounds, pipeline] = await Promise.all([
      repo.getJobSkills(id),
      repo.getJobRounds(id),
      repo.getPipelineCounts(id),
    ]);

    job.skills = skills;
    job.rounds = rounds;
    job.pipeline = pipeline;
    return job;
  }

  async getJobs(query = {}) {
    const filters = {
      status: query.status || '',
      company: query.company || '',
      role: query.role || '',
      job_type: query.job_type || '',
      work_mode: query.work_mode || '',
      location: query.location || '',
      ctc_min: query.ctc_min || '',
      ctc_max: query.ctc_max || '',
      deadline_from: query.deadline_from || '',
      deadline_to: query.deadline_to || '',
      search: query.search || '',
      sort: query.sort || 'newest',
      page: query.page || 1,
      limit: query.limit || 25,
    };
    return repo.findJobs(filters);
  }

  // ─── Applicants ─────────────────────────────────────────

  async getApplicants(jobId, filters = {}) {
    return repo.getApplicants(jobId, filters);
  }

  async moveApplicant(appId, stage, notes) {
    await repo.updateApplicantStage(appId, stage, notes);
  }

  async addNote(appId, note) {
    await repo.addApplicantNote(appId, note);
  }

  async bulkShortlist(appIds) {
    await repo.bulkUpdateStage(appIds, 'shortlisted');
  }

  async getPipeline(jobId) {
    return repo.getPipelineCounts(jobId);
  }

  // ─── Filter Options ─────────────────────────────────────

  async getFilterOptions() {
    const [companies, locations] = await Promise.all([
      repo.getDistinctCompanies(),
      repo.getDistinctLocations(),
    ]);
    return { companies, locations };
  }

  async getStats() {
    return repo.getStats();
  }

  // ─── Export ─────────────────────────────────────────────

  async exportJobs(filters = {}) {
    const ExcelJS = require('exceljs');
    const result = await repo.findJobs({ ...filters, limit: 10000 });
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Jobs');

    ws.columns = [
      { header: 'ID', key: 'id', width: 8 },
      { header: 'Company', key: 'company_name', width: 25 },
      { header: 'Role', key: 'role_title', width: 30 },
      { header: 'Type', key: 'job_type', width: 14 },
      { header: 'CTC Min', key: 'ctc_min', width: 12 },
      { header: 'CTC Max', key: 'ctc_max', width: 12 },
      { header: 'Location', key: 'location', width: 20 },
      { header: 'Work Mode', key: 'work_mode', width: 12 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Deadline', key: 'application_deadline', width: 14 },
      { header: 'Applicants', key: 'total_applicants', width: 12 },
      { header: 'Offers', key: 'offer_count', width: 10 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A4A' } };

    result.jobs.forEach(j => ws.addRow(j));
    return wb;
  }
}

module.exports = new JobMgmtService();
