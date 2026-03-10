const jobRepository = require('../repositories/jobRepository');
const { chatCompletion } = require('../config/openai');

class JobService {
  async getAll(userId) {
    return jobRepository.findByUserId(userId);
  }

  async getById(id) {
    const job = await jobRepository.findById(id);
    if (!job) throw new Error('Job not found');
    job.tasks = await jobRepository.getTasks(id);
    return job;
  }

  async create(userId, data) {
    return jobRepository.create({ userId, ...data });
  }

  async update(id, data) {
    return jobRepository.update(id, data);
  }

  async updateStatus(id, status) {
    return jobRepository.updateStatus(id, status);
  }

  async delete(id) {
    return jobRepository.delete(id);
  }

  async getStats(userId) {
    return jobRepository.getCountByStatus(userId);
  }

  async addTask(data) {
    return jobRepository.addTask(data);
  }

  async toggleTask(taskId) {
    return jobRepository.toggleTask(taskId);
  }

  async deleteTask(taskId) {
    return jobRepository.deleteTask(taskId);
  }

  async analyzeMatch(resumeText, jobDescription) {
    const prompt = `Analyze how well this resume matches the job description. Return JSON:
{
  "matchPercentage": (0-100),
  "matchingSkills": ["skills that match"],
  "missingSkills": ["skills the candidate lacks"],
  "gapAnalysis": "detailed analysis of gaps",
  "suggestions": ["improvement suggestions"]
}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON.`;

    const response = await chatCompletion(
      'You are an expert job match analyst. Evaluate candidate-job fit and provide actionable recommendations.',
      prompt,
      { temperature: 0.3 }
    );

    try {
      return JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return { matchPercentage: 0, matchingSkills: [], missingSkills: [], gapAnalysis: 'Analysis failed', suggestions: [] };
    }
  }
}

module.exports = new JobService();
