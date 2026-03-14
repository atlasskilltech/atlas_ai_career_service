const repo = require('../repositories/pipelineRepo');
const notificationService = require('./notificationService');

class PipelineService {
  async getAllJobs() {
    return repo.getAllJobsForPipeline();
  }

  async getPipelineData(jobId, filters = {}) {
    // Sync any new applications into pipeline
    await repo.syncFromApplications(jobId);

    const [cards, stats, job, filterOptions] = await Promise.all([
      repo.getPipelineByJob(jobId, filters),
      repo.getPipelineStats(jobId),
      repo.getJobForPipeline(jobId),
      repo.getFilterOptions(jobId),
    ]);

    if (!job) throw new Error('Job not found');

    // Group cards by stage
    const columns = {
      applied: [],
      shortlisted: [],
      interview: [],
      offered: [],
      rejected: [],
      withdrawn: [],
    };
    cards.forEach(card => {
      if (columns[card.stage]) {
        columns[card.stage].push(card);
      }
    });

    return { job, columns, stats, filterOptions };
  }

  async moveCard(applicationId, toStage, changedBy, reason) {
    const result = await repo.moveCard(applicationId, toStage, changedBy, reason);

    // Send email notification (non-blocking — don't fail the move if notification fails)
    try {
      const applicantInfo = await repo.getApplicantEmail(applicationId);
      if (applicantInfo) {
        await notificationService.notifyStageChange(applicantInfo, toStage, reason);
      }
    } catch (err) {
      console.error('Failed to send stage change notification:', err.message);
    }

    return result;
  }

  async reorderCards(jobId, stage, orderedIds) {
    await repo.reorderCards(jobId, stage, orderedIds);
  }

  async updatePriority(applicationId, priority) {
    await repo.updatePriority(applicationId, priority);
  }

  async updateNotes(applicationId, notes) {
    await repo.updateNotes(applicationId, notes);
  }

  async getHistory(applicationId) {
    return repo.getAuditLog(applicationId);
  }

  async getJobAuditLog(jobId) {
    return repo.getJobAuditLog(jobId);
  }

  async getTimelineData(jobId) {
    await repo.syncFromApplications(jobId);

    const [applicants, job, stats] = await Promise.all([
      repo.getTimelineByJob(jobId),
      repo.getJobForPipeline(jobId),
      repo.getPipelineStats(jobId),
    ]);

    if (!job) throw new Error('Job not found');
    return { job, applicants, stats };
  }
  async searchStudents(query) {
    return repo.searchStudents(query);
  }

  async addApplicant(jobId, userId, addedBy) {
    return repo.addApplicantManually(jobId, userId, addedBy);
  }
}

module.exports = new PipelineService();
