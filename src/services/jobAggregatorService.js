const jobAggregatorRepository = require('../repositories/jobAggregatorRepository');
const { chatCompletion } = require('../config/openai');

class JobAggregatorService {
  // ─── Job Search & Browse ───────────────────────────────────

  async searchJobs(filters) {
    return jobAggregatorRepository.search(filters);
  }

  async getJobById(id, userId) {
    const job = await jobAggregatorRepository.findById(id);
    if (!job) throw new Error('Job not found');
    if (job.skills && typeof job.skills === 'string') {
      try { job.skills = JSON.parse(job.skills); } catch { job.skills = []; }
    }
    if (userId) {
      job.isSaved = await jobAggregatorRepository.isSaved(userId, id);
      job.hasApplied = await jobAggregatorRepository.hasApplied(userId, id);
    }
    return job;
  }

  async getCategories() {
    return jobAggregatorRepository.getCategories();
  }

  async getLocations() {
    return jobAggregatorRepository.getLocations();
  }

  async getStats() {
    return jobAggregatorRepository.getStats();
  }

  // ─── Job CRUD (Admin/Manual) ───────────────────────────────

  async createJob(data) {
    if (data.skills && typeof data.skills === 'string') {
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    return jobAggregatorRepository.create(data);
  }

  async updateJob(id, data) {
    if (data.skills && typeof data.skills === 'string') {
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    return jobAggregatorRepository.update(id, data);
  }

  async deleteJob(id) {
    return jobAggregatorRepository.delete(id);
  }

  async deactivateJob(id) {
    return jobAggregatorRepository.deactivate(id);
  }

  async getAllJobs(filters) {
    return jobAggregatorRepository.getAll(filters);
  }

  // ─── Applications ──────────────────────────────────────────

  async applyToJob(userId, jobId, resumeId, coverLetter) {
    const hasApplied = await jobAggregatorRepository.hasApplied(userId, jobId);
    if (hasApplied) throw new Error('You have already applied to this job');
    return jobAggregatorRepository.applyToJob(userId, jobId, resumeId, coverLetter);
  }

  async getMyApplications(userId) {
    return jobAggregatorRepository.getUserApplications(userId);
  }

  async updateApplicationStatus(id, status) {
    return jobAggregatorRepository.updateApplicationStatus(id, status);
  }

  // ─── Saved Jobs ────────────────────────────────────────────

  async saveJob(userId, jobId) {
    return jobAggregatorRepository.saveJob(userId, jobId);
  }

  async unsaveJob(userId, jobId) {
    return jobAggregatorRepository.unsaveJob(userId, jobId);
  }

  async getSavedJobs(userId) {
    return jobAggregatorRepository.getSavedJobs(userId);
  }

  // ─── AI Job Processing ────────────────────────────────────

  async processJobWithAI(rawJob) {
    const prompt = `Analyze this job listing and extract structured data. Return JSON only:
{
  "normalizedTitle": "clean job title",
  "skills": ["skill1", "skill2"],
  "category": "one of: Engineering, Testing, Design, Marketing, Sales, Finance, HR, Operations, Data Science, DevOps, Management, Other",
  "experienceMin": number or 0,
  "experienceMax": number or null
}

Job Title: ${rawJob.title}
Company: ${rawJob.company}
Description: ${rawJob.description || 'N/A'}

Return ONLY valid JSON.`;

    try {
      const response = await chatCompletion(
        'You are a job data processor. Extract and normalize job information.',
        prompt,
        { temperature: 0.2 }
      );
      return JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return {
        normalizedTitle: rawJob.title,
        skills: [],
        category: 'Other',
        experienceMin: 0,
        experienceMax: null,
      };
    }
  }

  async matchJobToResume(resumeText, jobDescription) {
    const prompt = `Analyze how well this resume matches the job. Return JSON:
{
  "matchPercentage": (0-100),
  "matchingSkills": ["matched skills"],
  "missingSkills": ["skills to acquire"],
  "recommendations": ["actionable tips"],
  "resumeScore": (0-100)
}

RESUME:
${resumeText}

JOB:
${jobDescription}

Return ONLY valid JSON.`;

    try {
      const response = await chatCompletion(
        'You are an expert career advisor. Evaluate candidate-job fit.',
        prompt,
        { temperature: 0.3 }
      );
      return JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return { matchPercentage: 0, matchingSkills: [], missingSkills: [], recommendations: [], resumeScore: 0 };
    }
  }

  // ─── Bulk Import (for scrapers/APIs) ───────────────────────

  async bulkImportJobs(jobs, source) {
    const logId = await jobAggregatorRepository.createScraperLog(source);
    let added = 0;
    let updated = 0;

    try {
      for (const job of jobs) {
        const result = await jobAggregatorRepository.upsertByExternal({
          ...job,
          source,
        });
        if (result.updated) updated++;
        else added++;
      }
      await jobAggregatorRepository.updateScraperLog(logId, {
        status: 'completed', jobsFound: jobs.length, jobsAdded: added, jobsUpdated: updated,
      });
      return { added, updated, total: jobs.length };
    } catch (err) {
      await jobAggregatorRepository.updateScraperLog(logId, {
        status: 'failed', jobsFound: jobs.length, jobsAdded: added, jobsUpdated: updated, errorMessage: err.message,
      });
      throw err;
    }
  }

  // ─── Scraper Logs ──────────────────────────────────────────

  async getScraperLogs() {
    return jobAggregatorRepository.getScraperLogs();
  }

  // ─── Companies ─────────────────────────────────────────────

  async createCompany(data) {
    return jobAggregatorRepository.createCompany(data);
  }

  async getCompanies() {
    return jobAggregatorRepository.getCompanies();
  }
}

module.exports = new JobAggregatorService();
