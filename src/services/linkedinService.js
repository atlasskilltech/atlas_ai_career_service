const linkedinRepository = require('../repositories/linkedinRepository');
const { chatCompletion } = require('../config/openai');

class LinkedinService {
  async getLatest(userId) {
    return linkedinRepository.findLatest(userId);
  }

  async getAll(userId) {
    return linkedinRepository.findByUserId(userId);
  }

  async optimize(userId, data) {
    const prompt = `Analyze and optimize this LinkedIn profile. Return a JSON object with:
{
  "optimizedHeadline": "improved headline (max 220 chars)",
  "optimizedAbout": "improved about section (max 2600 chars)",
  "skillRecommendations": ["list of recommended skills to add"],
  "keywordSuggestions": ["important keywords to include"],
  "overallScore": (0-100),
  "tips": ["additional optimization tips"]
}

Current Headline: ${data.headline || 'Not provided'}
Current About: ${data.about || 'Not provided'}
Industry/Role: ${data.targetRole || 'Not specified'}

Return ONLY valid JSON.`;

    const response = await chatCompletion(
      'You are a LinkedIn optimization expert. Analyze profiles and provide actionable improvements to increase visibility and engagement.',
      prompt,
      { temperature: 0.5 }
    );

    let analysis;
    try {
      analysis = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      analysis = {
        optimizedHeadline: data.headline || '',
        optimizedAbout: data.about || '',
        skillRecommendations: [],
        keywordSuggestions: [],
        overallScore: 50,
        tips: ['Could not parse analysis. Please try again.'],
      };
    }

    return linkedinRepository.create({
      userId,
      originalHeadline: data.headline || '',
      optimizedHeadline: analysis.optimizedHeadline,
      originalAbout: data.about || '',
      optimizedAbout: analysis.optimizedAbout,
      skillRecommendations: analysis.skillRecommendations,
      keywordSuggestions: analysis.keywordSuggestions,
      overallScore: analysis.overallScore,
    });
  }
}

module.exports = new LinkedinService();
