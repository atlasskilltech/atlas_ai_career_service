const skillAnalysisRepository = require('../repositories/skillAnalysisRepository');
const { chatCompletion } = require('../config/openai');

class SkillService {
  async getAll(userId) {
    return skillAnalysisRepository.findByUserId(userId);
  }

  async analyze(userId, data) {
    const prompt = `Analyze the skill gap between the candidate's resume and target role. Return JSON:
{
  "currentSkills": ["skills the candidate has"],
  "missingSkills": ["skills needed but not present"],
  "matchPercentage": (0-100),
  "learningRoadmap": [
    {"skill": "skill name", "priority": "high/medium/low", "timeEstimate": "2 weeks", "description": "what to learn"}
  ],
  "recommendedCourses": [
    {"name": "course name", "platform": "platform", "skill": "related skill", "url": ""}
  ]
}

RESUME/SKILLS:
${data.resumeText}

TARGET ROLE: ${data.targetRole}

Return ONLY valid JSON.`;

    const response = await chatCompletion(
      'You are a career development expert specializing in skill gap analysis and learning roadmap creation.',
      prompt,
      { temperature: 0.4, maxTokens: 2500 }
    );

    let analysis;
    try {
      analysis = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      analysis = {
        currentSkills: [], missingSkills: [], matchPercentage: 0,
        learningRoadmap: [], recommendedCourses: [],
      };
    }

    return skillAnalysisRepository.create({
      userId,
      targetRole: data.targetRole,
      ...analysis,
    });
  }
}

module.exports = new SkillService();
