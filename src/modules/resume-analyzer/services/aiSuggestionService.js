const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, contentQualityPrompt, resumeImprovementPrompt, experienceRelevancePrompt } = require('../ai-prompts');

class AiSuggestionService {
  /**
   * Analyze content quality of resume
   */
  async analyzeContentQuality(resumeText) {
    try {
      const prompt = contentQualityPrompt(resumeText.substring(0, 5000));

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.2,
        maxTokens: 2000,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        weak_statements: parsed.weak_statements || [],
        strong_verbs_used: parsed.strong_verbs_used || [],
        missing_action_verbs: parsed.missing_action_verbs || [],
        content_score: parsed.content_score || 0,
        has_measurable_impact: parsed.has_measurable_impact !== false,
        passive_sentence_count: parsed.passive_sentence_count || 0,
      };
    } catch (err) {
      console.error('Content quality analysis error:', err.message);
      return {
        weak_statements: [],
        strong_verbs_used: [],
        missing_action_verbs: ['Developed', 'Designed', 'Optimized', 'Implemented', 'Led'],
        content_score: 50,
        has_measurable_impact: false,
        passive_sentence_count: 0,
      };
    }
  }

  /**
   * Analyze experience relevance to job description
   */
  async analyzeExperienceRelevance(resumeText, jobDescription) {
    try {
      const prompt = experienceRelevancePrompt(
        resumeText.substring(0, 4000),
        jobDescription.substring(0, 3000)
      );

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.2,
        maxTokens: 1500,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        relevance_score: parsed.relevance_score || 0,
        relevant_experiences: parsed.relevant_experiences || [],
        irrelevant_experiences: parsed.irrelevant_experiences || [],
        experience_gaps: parsed.experience_gaps || [],
      };
    } catch (err) {
      console.error('Experience relevance analysis error:', err.message);
      return {
        relevance_score: 50,
        relevant_experiences: [],
        irrelevant_experiences: [],
        experience_gaps: [],
      };
    }
  }

  /**
   * Generate improvement suggestions based on all analysis results
   */
  async generateSuggestions(resumeText, jobDescription, analysisContext) {
    try {
      const contextStr = JSON.stringify(analysisContext).substring(0, 2000);
      const prompt = resumeImprovementPrompt(
        resumeText.substring(0, 3000),
        jobDescription.substring(0, 2000),
        contextStr
      );

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.3,
        maxTokens: 2000,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        formatting_improvements: parsed.formatting_improvements || [],
        content_improvements: parsed.content_improvements || [],
        missing_sections: parsed.missing_sections || [],
        keyword_suggestions: parsed.keyword_suggestions || [],
        overall_recommendations: parsed.overall_recommendations || [],
      };
    } catch (err) {
      console.error('Suggestion generation error:', err.message);
      return {
        formatting_improvements: [],
        content_improvements: [],
        missing_sections: [],
        keyword_suggestions: [],
        overall_recommendations: [
          'Add measurable achievements with specific metrics',
          'Use strong action verbs (Developed, Designed, Optimized)',
          'Include missing keywords from the job description',
          'Use bullet points instead of paragraphs',
          'Keep resume to 1-2 pages',
        ],
      };
    }
  }

  /**
   * Calculate content quality score (0-100)
   */
  calculateContentScore(analysisResult) {
    return Math.min(100, Math.max(0, analysisResult.content_score || 0));
  }

  /**
   * Calculate experience relevance score (0-100)
   * Blends AI score with deterministic baseline to prevent wild swings
   */
  calculateExperienceScore(analysisResult) {
    const aiScore = Math.min(100, Math.max(0, analysisResult.relevance_score || 0));

    // Deterministic baseline from structured data
    let baseline = 0;
    const relevant = (analysisResult.relevant_experiences || []).length;
    const irrelevant = (analysisResult.irrelevant_experiences || []).length;
    const gaps = (analysisResult.experience_gaps || []).length;
    const total = relevant + irrelevant;

    if (total > 0) {
      // Ratio of relevant to total experiences: up to 60 points
      baseline += Math.round((relevant / total) * 60);
    } else if (relevant > 0) {
      baseline += 60;
    }

    // Fewer gaps is better: up to 30 points
    if (gaps === 0) baseline += 30;
    else if (gaps <= 2) baseline += 20;
    else if (gaps <= 4) baseline += 10;

    // Has any relevant experience at all: +10
    if (relevant > 0) baseline += 10;

    baseline = Math.min(100, baseline);

    // Blend: 60% AI, 40% deterministic
    return Math.round(aiScore * 0.6 + baseline * 0.4);
  }
}

module.exports = new AiSuggestionService();
