const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, contentQualityPrompt, resumeImprovementPrompt, experienceRelevancePrompt } = require('../ai-prompts');

class AiSuggestionService {
  /**
   * Analyze content quality of resume
   */
  async analyzeContentQuality(resumeText) {
    // Deterministic content analysis first
    const deterministic = this._deterministicContentAnalysis(resumeText);

    try {
      const prompt = contentQualityPrompt(resumeText.substring(0, 5000));

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.1,
        maxTokens: 2000,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        weak_statements: parsed.weak_statements || [],
        strong_verbs_used: parsed.strong_verbs_used || deterministic.strong_verbs_used,
        missing_action_verbs: parsed.missing_action_verbs || [],
        content_score: deterministic.content_score,
        _ai_content_score: parsed.content_score || 0,
        has_measurable_impact: deterministic.has_measurable_impact,
        passive_sentence_count: parsed.passive_sentence_count || 0,
      };
    } catch (err) {
      console.error('Content quality analysis error:', err.message);
      return {
        weak_statements: [],
        strong_verbs_used: deterministic.strong_verbs_used,
        missing_action_verbs: ['Developed', 'Designed', 'Optimized', 'Implemented', 'Led'],
        content_score: deterministic.content_score,
        has_measurable_impact: deterministic.has_measurable_impact,
        passive_sentence_count: 0,
      };
    }
  }

  /**
   * Deterministic content quality analysis
   */
  _deterministicContentAnalysis(text) {
    const lines = text.split('\n').filter(l => l.trim());
    let score = 0;

    // Strong action verbs used: up to 25
    const actionVerbPattern = /\b(developed|designed|implemented|managed|led|created|built|optimized|improved|reduced|increased|achieved|delivered|launched|analyzed|coordinated|collaborated|engineered|automated|streamlined|spearheaded|orchestrated|architected|established|executed|maintained|resolved|configured|deployed|integrated|monitored|tested|documented|mentored|trained)\b/gi;
    const allVerbs = text.match(actionVerbPattern) || [];
    const uniqueVerbs = new Set(allVerbs.map(v => v.toLowerCase()));
    score += Math.min(25, uniqueVerbs.size * 3);

    // Measurable impact (numbers, percentages, $): up to 25
    const metrics = text.match(/\d+%|\$[\d,]+|\d+\+?\s*(users|clients|projects|team|members|years|months|hours|applications|tickets|tests|bugs|requests)/gi) || [];
    const hasMetrics = metrics.length > 0;
    score += Math.min(25, metrics.length * 5);

    // Sentence variety (not all starting same way): up to 15
    const bulletLines = lines.filter(l => /^[\s]*[•·●▪▸►\-*]/.test(l));
    if (bulletLines.length >= 3) {
      const starters = bulletLines.map(l => l.replace(/^[\s]*[•·●▪▸►\-*]\s*/, '').split(/\s/)[0]?.toLowerCase());
      const uniqueStarters = new Set(starters.filter(Boolean));
      const variety = bulletLines.length > 0 ? uniqueStarters.size / bulletLines.length : 0;
      score += Math.round(variety * 15);
    } else {
      score += 5;
    }

    // Sufficient detail (word count per experience entry): up to 15
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount >= 300) score += 15;
    else if (wordCount >= 200) score += 10;
    else if (wordCount >= 100) score += 5;

    // No excessive repetition: up to 10
    const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
    const wordFreq = {};
    words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
    const maxFreq = Math.max(0, ...Object.values(wordFreq));
    if (maxFreq <= 5) score += 10;
    else if (maxFreq <= 10) score += 5;

    // Professional tone (no first person pronouns like "I", "my"): up to 10
    const firstPerson = text.match(/\b(I|my|me|myself)\b/g) || [];
    if (firstPerson.length === 0) score += 10;
    else if (firstPerson.length <= 3) score += 5;

    score = Math.min(100, Math.max(0, score));

    return {
      content_score: score,
      has_measurable_impact: hasMetrics,
      strong_verbs_used: [...uniqueVerbs],
    };
  }

  /**
   * Analyze experience relevance to job description
   */
  async analyzeExperienceRelevance(resumeText, jobDescription) {
    // Compute deterministic relevance first
    const deterministic = this._deterministicExperienceRelevance(resumeText, jobDescription);

    try {
      const prompt = experienceRelevancePrompt(
        resumeText.substring(0, 4000),
        jobDescription.substring(0, 3000)
      );

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.1,
        maxTokens: 1500,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        relevance_score: deterministic.relevance_score,
        _ai_relevance_score: parsed.relevance_score || 0,
        relevant_experiences: parsed.relevant_experiences || [],
        irrelevant_experiences: parsed.irrelevant_experiences || [],
        experience_gaps: parsed.experience_gaps || [],
      };
    } catch (err) {
      console.error('Experience relevance analysis error:', err.message);
      return {
        relevance_score: deterministic.relevance_score,
        relevant_experiences: [],
        irrelevant_experiences: [],
        experience_gaps: [],
      };
    }
  }

  /**
   * Deterministic experience relevance calculation based on keyword overlap
   */
  _deterministicExperienceRelevance(resumeText, jobDescription) {
    const resumeLower = resumeText.toLowerCase();
    const jdLower = jobDescription.toLowerCase();

    // Extract significant words/phrases from JD
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'it', 'its', 'we', 'you', 'they', 'our', 'your', 'their', 'not',
      'as', 'if', 'than', 'more', 'also', 'about', 'such', 'through',
      'up', 'out', 'all', 'just', 'into', 'over', 'after', 'before',
      'who', 'what', 'which', 'work', 'working', 'ability', 'must', 'required',
      'preferred', 'including', 'etc', 'strong', 'good', 'excellent',
    ]);

    // Get JD keywords (3+ char words, not stop words)
    const jdWords = jdLower.match(/\b[a-z][a-z+#.]{2,}\b/g) || [];
    const jdKeywords = new Set();
    const jdFreq = {};
    for (const w of jdWords) {
      if (!stopWords.has(w)) {
        jdFreq[w] = (jdFreq[w] || 0) + 1;
      }
    }
    // Take top keywords by frequency
    Object.entries(jdFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .forEach(([w]) => jdKeywords.add(w));

    if (jdKeywords.size === 0) {
      return { relevance_score: 50 };
    }

    // Check how many JD keywords appear in the resume's experience section
    // Try to isolate experience text
    let experienceText = resumeLower;
    const expStart = resumeLower.indexOf('experience');
    if (expStart !== -1) {
      const nextSections = ['education', 'skills', 'projects', 'certifications', 'achievements'];
      let expEnd = resumeLower.length;
      for (const section of nextSections) {
        const idx = resumeLower.indexOf(section, expStart + 10);
        if (idx !== -1 && idx < expEnd) expEnd = idx;
      }
      experienceText = resumeLower.substring(expStart, expEnd);
    }

    let matchCount = 0;
    for (const keyword of jdKeywords) {
      if (experienceText.includes(keyword)) matchCount++;
    }

    const matchRatio = matchCount / jdKeywords.size;

    // Score: keyword overlap ratio × 80 + base 10 for having experience section
    let score = Math.round(matchRatio * 80);
    if (expStart !== -1) score += 10;

    // Check for years of experience mentions
    if (/\d+\+?\s*(years?|yrs?)\s*(of\s*)?(experience|expertise)/i.test(resumeText)) {
      score += 10;
    }

    score = Math.min(100, Math.max(0, score));

    return { relevance_score: score };
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
   * Calculate content quality score (0-100) — fully deterministic for consistency
   */
  calculateContentScore(analysisResult) {
    return Math.min(100, Math.max(0, analysisResult.content_score || 0));
  }

  /**
   * Calculate experience relevance score (0-100) — fully deterministic for consistency
   */
  calculateExperienceScore(analysisResult) {
    return Math.min(100, Math.max(0, analysisResult.relevance_score || 0));
  }
}

module.exports = new AiSuggestionService();
