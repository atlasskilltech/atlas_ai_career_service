const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, skillGapPrompt } = require('../ai-prompts');

class SkillGapService {
  /**
   * Analyze skill gaps between resume and job description
   */
  async analyze(resumeText, jobDescription) {
    try {
      const prompt = skillGapPrompt(
        resumeText.substring(0, 4000),
        jobDescription.substring(0, 3000)
      );

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.2,
        maxTokens: 2000,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        existing_skills: parsed.existing_skills || [],
        missing_skills: parsed.missing_skills || [],
        recommended_skills: parsed.recommended_skills || [],
        skills_match_percentage: parsed.skills_match_percentage || 0,
      };
    } catch (err) {
      console.error('Skill gap analysis error:', err.message);
      return {
        existing_skills: [],
        missing_skills: [],
        recommended_skills: [],
        skills_match_percentage: 0,
      };
    }
  }

  /**
   * Calculate skills match score (0-100)
   */
  calculateScore(analysisResult) {
    return Math.min(100, Math.max(0, analysisResult.skills_match_percentage || 0));
  }
}

module.exports = new SkillGapService();
