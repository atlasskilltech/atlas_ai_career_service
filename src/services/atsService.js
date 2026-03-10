const atsRepository = require('../repositories/atsRepository');
const { chatCompletion } = require('../config/openai');

class AtsService {
  async analyzeResume(userId, resumeText, jobDescription, resumeId) {
    const prompt = `Analyze this resume against the job description for ATS compatibility. Return a JSON object with:
{
  "atsScore": (0-100),
  "keywordMatches": ["list of matching keywords found"],
  "missingKeywords": ["important keywords missing from resume"],
  "formattingIssues": ["any formatting problems for ATS"],
  "suggestions": ["specific improvement suggestions"]
}

RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription}

Return ONLY valid JSON, no markdown or explanation.`;

    let analysis;
    try {
      const response = await chatCompletion(
        'You are an expert ATS (Applicant Tracking System) analyzer. Analyze resumes against job descriptions and provide detailed scoring and recommendations. Always return valid JSON.',
        prompt,
        { temperature: 0.3 }
      );
      analysis = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      analysis = {
        atsScore: 50,
        keywordMatches: [],
        missingKeywords: [],
        formattingIssues: ['AI analysis unavailable'],
        suggestions: ['Please configure OPENAI_API_KEY in .env'],
      };
    }

    const saved = await atsRepository.create({
      userId,
      resumeId,
      jobDescription,
      atsScore: analysis.atsScore,
      keywordMatches: analysis.keywordMatches,
      missingKeywords: analysis.missingKeywords,
      formattingIssues: analysis.formattingIssues,
      suggestions: analysis.suggestions,
    });

    return { ...saved, ...analysis };
  }

  async getHistory(userId) {
    return atsRepository.findByUserId(userId);
  }
}

module.exports = new AtsService();
