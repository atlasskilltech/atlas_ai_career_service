const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, keywordMatchPrompt } = require('../ai-prompts');

class KeywordAnalyzerService {
  /**
   * Analyze keyword match between resume and job description using AI
   */
  async analyze(resumeText, jobDescription) {
    try {
      const prompt = keywordMatchPrompt(
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
        matched_keywords: parsed.matched_keywords || [],
        missing_keywords: parsed.missing_keywords || [],
        keyword_density: parsed.keyword_density || {
          total_jd_keywords: 0,
          matched_count: 0,
          match_percentage: 0,
        },
      };
    } catch (err) {
      console.error('Keyword analysis error:', err.message);
      return this._fallbackAnalysis(resumeText, jobDescription);
    }
  }

  /**
   * Fallback regex-based keyword extraction when AI is unavailable
   */
  _fallbackAnalysis(resumeText, jobDescription) {
    const resumeLower = resumeText.toLowerCase();
    const jdWords = this._extractKeywords(jobDescription);
    const matched = [];
    const missing = [];

    for (const word of jdWords) {
      if (resumeLower.includes(word.toLowerCase())) {
        matched.push({ keyword: word, category: 'general' });
      } else {
        missing.push({ keyword: word, category: 'general' });
      }
    }

    const total = matched.length + missing.length;
    return {
      matched_keywords: matched,
      missing_keywords: missing,
      keyword_density: {
        total_jd_keywords: total,
        matched_count: matched.length,
        match_percentage: total > 0 ? Math.round((matched.length / total) * 100) : 0,
      },
    };
  }

  /**
   * Extract significant keywords from text
   */
  _extractKeywords(text) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'it', 'its', 'we', 'you', 'they', 'our', 'your', 'their', 'not',
      'as', 'if', 'than', 'more', 'also', 'about', 'such', 'through',
      'up', 'out', 'all', 'just', 'into', 'over', 'after', 'before',
    ]);

    const words = text.match(/\b[A-Za-z][A-Za-z+#.]{2,}\b/g) || [];
    const freq = {};
    for (const word of words) {
      const lower = word.toLowerCase();
      if (!stopWords.has(lower)) {
        freq[word] = (freq[word] || 0) + 1;
      }
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
      .map(([word]) => word);
  }

  /**
   * Calculate keyword match score (0-100)
   */
  calculateScore(analysisResult) {
    const density = analysisResult.keyword_density;
    return Math.min(100, Math.max(0, density.match_percentage || 0));
  }
}

module.exports = new KeywordAnalyzerService();
