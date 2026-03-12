const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, keywordMatchPrompt } = require('../ai-prompts');

class KeywordAnalyzerService {
  /**
   * Analyze keyword match between resume and job description.
   * Uses AI to extract keywords from JD, then deterministic string matching for scoring.
   */
  async analyze(resumeText, jobDescription) {
    try {
      const prompt = keywordMatchPrompt(
        resumeText.substring(0, 4000),
        jobDescription.substring(0, 3000)
      );

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.1,
        maxTokens: 2000,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      // AI extracts keywords — now we re-verify matches deterministically
      const allKeywords = [
        ...(parsed.matched_keywords || []),
        ...(parsed.missing_keywords || []),
      ];

      if (allKeywords.length === 0) {
        return this._fallbackAnalysis(resumeText, jobDescription);
      }

      return this._deterministicMatch(resumeText, allKeywords);
    } catch (err) {
      console.error('Keyword analysis error:', err.message);
      return this._fallbackAnalysis(resumeText, jobDescription);
    }
  }

  /**
   * Deterministic keyword matching — takes AI-extracted keywords and
   * verifies presence in resume text via string matching
   */
  _deterministicMatch(resumeText, allKeywords) {
    const resumeLower = resumeText.toLowerCase();
    const matched = [];
    const missing = [];
    const seen = new Set();

    for (const item of allKeywords) {
      const keyword = item.keyword || (typeof item === 'string' ? item : '');
      if (!keyword) continue;

      const keyLower = keyword.toLowerCase().trim();
      if (seen.has(keyLower)) continue;
      seen.add(keyLower);

      const category = item.category || 'general';

      // Check for presence: exact word match or phrase match
      const escaped = keyLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      const isPresent = regex.test(resumeText) || resumeLower.includes(keyLower);

      if (isPresent) {
        matched.push({ keyword, category });
      } else {
        missing.push({ keyword, category });
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
   * Calculate keyword match score (0-100) — fully deterministic
   */
  calculateScore(analysisResult) {
    const density = analysisResult.keyword_density;
    return Math.min(100, Math.max(0, density.match_percentage || 0));
  }
}

module.exports = new KeywordAnalyzerService();
