const resumeRepository = require('../repositories/resumeRepository');
const { chatCompletion } = require('../config/openai');

class ResumeService {
  async getAll(userId) {
    return resumeRepository.findByUserId(userId);
  }

  async getById(id) {
    const resume = await resumeRepository.findById(id);
    if (!resume) throw new Error('Resume not found');
    // Parse JSON fields
    if (resume.profile_data && typeof resume.profile_data === 'string') resume.profile_data = JSON.parse(resume.profile_data);
    if (resume.education_data && typeof resume.education_data === 'string') resume.education_data = JSON.parse(resume.education_data);
    if (resume.experience_data && typeof resume.experience_data === 'string') resume.experience_data = JSON.parse(resume.experience_data);
    if (resume.projects_data && typeof resume.projects_data === 'string') resume.projects_data = JSON.parse(resume.projects_data);
    if (resume.skills_data && typeof resume.skills_data === 'string') resume.skills_data = JSON.parse(resume.skills_data);
    if (resume.achievements_data && typeof resume.achievements_data === 'string') resume.achievements_data = JSON.parse(resume.achievements_data);
    return resume;
  }

  async create(userId, data) {
    return resumeRepository.create({ userId, ...data });
  }

  async update(id, data) {
    return resumeRepository.update(id, data);
  }

  async delete(id) {
    return resumeRepository.delete(id);
  }

  async setPrimary(userId, resumeId) {
    return resumeRepository.setPrimary(userId, resumeId);
  }

  async generateBulletPoints(experience) {
    try {
      const prompt = `Generate 3-4 impactful resume bullet points for the following work experience. Use strong action verbs, quantify achievements where possible, and follow the XYZ formula (Accomplished X, as measured by Y, by doing Z).

Role: ${experience.title}
Company: ${experience.company}
Description: ${experience.description || 'N/A'}

Return ONLY the bullet points, one per line, starting with •`;

      return await chatCompletion(
        'You are an expert resume writer. Generate concise, impactful bullet points that highlight achievements and use metrics.',
        prompt
      );
    } catch {
      return 'AI generation unavailable. Please configure OPENAI_API_KEY.';
    }
  }

  async generateSummary(resumeData) {
    try {
      const prompt = `Generate a professional resume summary (2-3 sentences) based on:
Name: ${resumeData.name || 'N/A'}
Skills: ${resumeData.skills || 'N/A'}
Experience: ${resumeData.experience || 'N/A'}
Education: ${resumeData.education || 'N/A'}

Return ONLY the summary text, no labels or prefixes.`;

      return await chatCompletion(
        'You are an expert resume writer. Create compelling professional summaries that highlight key strengths and career objectives.',
        prompt
      );
    } catch {
      return 'AI generation unavailable. Please configure OPENAI_API_KEY.';
    }
  }

  async rewriteAchievement(achievement) {
    try {
      const prompt = `Rewrite this achievement to be more impactful for a resume. Use strong action verbs, add metrics if possible, and make it concise:

"${achievement}"

Return ONLY the rewritten achievement, nothing else.`;

      return await chatCompletion(
        'You are an expert resume writer specializing in achievement-focused bullet points.',
        prompt
      );
    } catch {
      return 'AI generation unavailable. Please configure OPENAI_API_KEY.';
    }
  }
}

module.exports = new ResumeService();
