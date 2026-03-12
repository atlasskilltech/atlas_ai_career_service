const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, formattingAnalysisPrompt } = require('../ai-prompts');

class FormattingAnalyzerService {
  /**
   * Analyze resume formatting and structure issues
   */
  async analyze(resumeText) {
    try {
      const prompt = formattingAnalysisPrompt(resumeText.substring(0, 5000));

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.2,
        maxTokens: 1500,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      return {
        issues: parsed.issues || [],
        sections_detected: parsed.sections_detected || [],
        has_bullet_points: parsed.has_bullet_points !== false,
        has_metrics: parsed.has_metrics !== false,
        estimated_length: parsed.estimated_length || 'optimal',
        formatting_score: parsed.formatting_score || 0,
      };
    } catch (err) {
      console.error('Formatting analysis error:', err.message);
      return this._fallbackAnalysis(resumeText);
    }
  }

  /**
   * Fallback regex-based formatting analysis
   */
  _fallbackAnalysis(text) {
    const issues = [];
    const lines = text.split('\n').filter(l => l.trim());

    // Check for bullet points
    const bulletLines = lines.filter(l => /^[\s]*[•·●▪▸►\-*]/.test(l));
    if (bulletLines.length < 3) {
      issues.push({
        type: 'no_bullet_points',
        description: 'Resume lacks bullet points. Use bullet points to highlight achievements and responsibilities.',
        severity: 'high',
      });
    }

    // Check for long paragraphs
    const longParagraphs = lines.filter(l => l.length > 200);
    if (longParagraphs.length > 2) {
      issues.push({
        type: 'long_paragraphs',
        description: 'Resume contains long paragraphs. Break them into concise bullet points.',
        severity: 'medium',
      });
    }

    // Check for section headers
    const sectionHeaders = ['experience', 'education', 'skills', 'summary', 'projects'];
    const textLower = text.toLowerCase();
    const missingSections = sectionHeaders.filter(h => !textLower.includes(h));
    if (missingSections.length > 2) {
      issues.push({
        type: 'missing_sections',
        description: `Missing section headers: ${missingSections.join(', ')}`,
        severity: 'high',
      });
    }

    // Check for measurable achievements
    const hasMetrics = /\d+%|\$\d+|\d+\+?\s*(users|clients|projects|team|members)/i.test(text);
    if (!hasMetrics) {
      issues.push({
        type: 'no_measurable_achievements',
        description: 'No measurable achievements found. Add metrics like percentages, dollar amounts, or quantities.',
        severity: 'high',
      });
    }

    // Check resume length
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 150) {
      issues.push({
        type: 'too_short',
        description: 'Resume appears too short. Add more details about your experience and skills.',
        severity: 'medium',
      });
    } else if (wordCount > 1200) {
      issues.push({
        type: 'too_long',
        description: 'Resume may be too long. Consider condensing to 1-2 pages.',
        severity: 'low',
      });
    }

    // Check contact info
    const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
    const hasPhone = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/.test(text);
    if (!hasEmail || !hasPhone) {
      issues.push({
        type: 'missing_contact',
        description: 'Missing contact information (email and/or phone number).',
        severity: 'high',
      });
    }

    const formattingScore = Math.max(0, 100 - issues.length * 15);

    return {
      issues,
      sections_detected: sectionHeaders.filter(h => textLower.includes(h)),
      has_bullet_points: bulletLines.length >= 3,
      has_metrics: hasMetrics,
      estimated_length: wordCount < 150 ? 'short' : wordCount > 1200 ? 'long' : 'optimal',
      formatting_score: formattingScore,
    };
  }

  /**
   * Deterministic baseline score from structural checks
   */
  _deterministicBaseline(analysisResult) {
    let score = 0;
    // Has bullet points: +25
    if (analysisResult.has_bullet_points) score += 25;
    // Has metrics/measurable achievements: +20
    if (analysisResult.has_metrics) score += 20;
    // Section coverage: up to +30
    const sectionCount = (analysisResult.sections_detected || []).length;
    score += Math.min(30, sectionCount * 6);
    // Optimal length: +15
    if (analysisResult.estimated_length === 'optimal') score += 15;
    else if (analysisResult.estimated_length === 'short') score += 5;
    else score += 10; // long
    // Low issue count bonus: +10
    const issueCount = (analysisResult.issues || []).length;
    if (issueCount === 0) score += 10;
    else if (issueCount <= 2) score += 5;
    return Math.min(100, score);
  }

  /**
   * Calculate formatting score (0-100)
   * Blends AI score (60%) with deterministic baseline (40%) to prevent wild swings
   */
  calculateScore(analysisResult) {
    const aiScore = Math.min(100, Math.max(0, analysisResult.formatting_score || 0));
    const baseline = this._deterministicBaseline(analysisResult);
    return Math.round(aiScore * 0.6 + baseline * 0.4);
  }
}

module.exports = new FormattingAnalyzerService();
