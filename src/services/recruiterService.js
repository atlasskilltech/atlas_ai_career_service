const repo = require('../repositories/recruiterRepo');

class RecruiterService {
  async createRecruiter(data) {
    const id = await repo.create(data);
    await repo.recalcTier(id);
    return id;
  }

  async updateRecruiter(id, data) {
    await repo.update(id, data);
    await repo.recalcTier(id);
  }

  async getRecruiter(id) {
    return repo.findById(id);
  }

  async listRecruiters(query = {}) {
    const filters = {};
    if (query.search) filters.search = query.search;
    if (query.industry) filters.industry = query.industry;
    if (query.tier) filters.tier = query.tier;
    if (query.mou_status) filters.mou_status = query.mou_status;
    if (query.company_size) filters.company_size = query.company_size;
    if (query.hire_min) filters.hire_min = query.hire_min;
    if (query.hire_max) filters.hire_max = query.hire_max;
    return repo.findAll(filters);
  }

  async getProfile(id) {
    const recruiter = await repo.findById(id);
    if (!recruiter) return null;
    const [stats, jobs, hiredStudents, interactions, analytics] = await Promise.all([
      repo.getStats(id),
      repo.getJobs(id),
      repo.getHiredStudents(id),
      repo.getInteractions(id),
      repo.getAnalytics(id)
    ]);
    return { recruiter, stats, jobs, hiredStudents, interactions, analytics };
  }

  async getStats(id) {
    return repo.getStats(id);
  }

  async getJobs(id) {
    return repo.getJobs(id);
  }

  async addInteraction(recruiterId, data) {
    const id = await repo.addInteraction(recruiterId, data);
    return id;
  }

  async markFollowUpDone(interactionId) {
    await repo.markFollowUpDone(interactionId);
  }

  async getFilterOptions() {
    const industries = await repo.getDistinctIndustries();
    return { industries };
  }

  async getListStats() {
    return repo.getListStats();
  }

  async getPendingFollowUps(limit) {
    return repo.getPendingFollowUps(limit);
  }

  async recalcAllTiers() {
    await repo.recalcAllTiers();
  }
}

module.exports = new RecruiterService();
