const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, formattingAnalysisPrompt } = require('../ai-prompts');

class FormattingAnalyzerService {
  /**
   * Analyze resume formatting and structure issues
   */
  async analyze(resumeText) {
    // Always run deterministic analysis first as the baseline
    const deterministic = this._deterministicAnalysis(resumeText);

    try {
      const prompt = formattingAnalysisPrompt(resumeText.substring(0, 5000));

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.1,
        maxTokens: 1500,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      // Merge AI issues with deterministic ones (AI may find additional issues)
      const aiIssues = parsed.issues || [];
      const mergedIssues = this._mergeIssues(deterministic.issues, aiIssues);

      return {
        issues: mergedIssues,
        sections_detected: deterministic.sections_detected,
        has_bullet_points: deterministic.has_bullet_points,
        has_metrics: deterministic.has_metrics,
        estimated_length: deterministic.estimated_length,
        formatting_score: deterministic.formatting_score,
        _ai_score: parsed.formatting_score || 0,
      };
    } catch (err) {
      console.error('Formatting analysis error:', err.message);
      return deterministic;
    }
  }

  /**
   * Deterministic formatting analysis — primary scoring source
   */
  _deterministicAnalysis(text) {
    const issues = [];
    const lines = text.split('\n').filter(l => l.trim());
    const textLower = text.toLowerCase();
    const wordCount = text.split(/\s+/).filter(Boolean).length;

    // Check for bullet points
    const bulletLines = lines.filter(l => /^[\s]*[•·●▪▸►\-*]/.test(l));
    const hasBullets = bulletLines.length >= 3;
    if (!hasBullets) {
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
    const sectionsFound = sectionHeaders.filter(h => textLower.includes(h));
    const missingSections = sectionHeaders.filter(h => !textLower.includes(h));
    if (missingSections.length > 2) {
      issues.push({
        type: 'missing_sections',
        description: `Missing section headers: ${missingSections.join(', ')}`,
        severity: 'high',
      });
    }

    // Check for measurable achievements
    const hasMetrics = /\d+%|\$[\d,]+|\d+\+?\s*(users|clients|projects|team|members|years|months|applications|tickets|tests|bugs)/i.test(text);
    if (!hasMetrics) {
      issues.push({
        type: 'no_measurable_achievements',
        description: 'No measurable achievements found. Add metrics like percentages, dollar amounts, or quantities.',
        severity: 'high',
      });
    }

    // Check resume length
    let lengthStatus = 'optimal';
    if (wordCount < 150) {
      lengthStatus = 'short';
      issues.push({
        type: 'too_short',
        description: 'Resume appears too short. Add more details about your experience and skills.',
        severity: 'medium',
      });
    } else if (wordCount > 1200) {
      lengthStatus = 'long';
      issues.push({
        type: 'too_long',
        description: 'Resume may be too long. Consider condensing to 1-2 pages.',
        severity: 'low',
      });
    }

    // Check contact info
    const hasEmail = /[\w.+-]+@[\w-]+\.[\w.]+/.test(text);
    const hasPhone = /(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/.test(text);
    if (!hasEmail && !hasPhone) {
      issues.push({
        type: 'missing_contact',
        description: 'Missing contact information (email and/or phone number).',
        severity: 'high',
      });
    }

    // Check for action verbs at start of bullets
    const actionVerbs = /^[\s]*[•·●▪▸►\-*]\s*(developed|designed|implemented|managed|led|created|built|optimized|improved|reduced|increased|achieved|delivered|launched|analyzed|coordinated|collaborated)/i;
    const actionBullets = lines.filter(l => actionVerbs.test(l));
    const hasActionVerbs = actionBullets.length >= 2;

    // Calculate deterministic score
    let score = 0;

    // Bullet points: 0-20
    if (hasBullets) {
      score += Math.min(20, bulletLines.length * 2);
    }

    // Section headers: 0-25
    score += Math.min(25, sectionsFound.length * 5);

    // Metrics/achievements: 0-15
    if (hasMetrics) score += 15;

    // Optimal length: 0-15
    if (lengthStatus === 'optimal') score += 15;
    else if (lengthStatus === 'long') score += 10;
    else score += 5;

    // Contact info: 0-10
    if (hasEmail) score += 5;
    if (hasPhone) score += 5;

    // Action verbs: 0-10
    if (hasActionVerbs) score += Math.min(10, actionBullets.length * 2);

    // Low issue penalty
    const highIssues = issues.filter(i => i.severity === 'high').length;
    score = Math.max(0, score - highIssues * 5);

    // No long paragraphs bonus: +5
    if (longParagraphs.length === 0) score += 5;

    score = Math.min(100, Math.max(0, score));

    return {
      issues,
      sections_detected: sectionsFound,
      has_bullet_points: hasBullets,
      has_metrics: hasMetrics,
      estimated_length: lengthStatus,
      formatting_score: score,
    };
  }

  /**
   * Merge deterministic and AI issues, deduplicating by type
   */
  _mergeIssues(deterministicIssues, aiIssues) {
    const existingTypes = new Set(deterministicIssues.map(i => i.type));
    const merged = [...deterministicIssues];
    for (const issue of aiIssues) {
      if (issue.type && !existingTypes.has(issue.type)) {
        merged.push(issue);
        existingTypes.add(issue.type);
      }
    }
    return merged;
  }

  /**
   * Calculate formatting score (0-100) — fully deterministic for consistency
   */
  calculateScore(analysisResult) {
    return Math.min(100, Math.max(0, analysisResult.formatting_score || 0));
  }
}

module.exports = new FormattingAnalyzerService();
