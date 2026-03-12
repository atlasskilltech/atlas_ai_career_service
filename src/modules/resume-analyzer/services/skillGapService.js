const { chatCompletion } = require('../../../config/openai');
const { systemPrompt, skillGapPrompt } = require('../ai-prompts');

class SkillGapService {
  /**
   * Analyze skill gaps between resume and job description.
   * Uses AI to identify skills, then deterministic matching for scoring.
   */
  async analyze(resumeText, jobDescription) {
    try {
      const prompt = skillGapPrompt(
        resumeText.substring(0, 4000),
        jobDescription.substring(0, 3000)
      );

      const response = await chatCompletion(systemPrompt, prompt, {
        temperature: 0.1,
        maxTokens: 2000,
        timeout: 20000,
      });

      const parsed = JSON.parse(response.replace(/```json?\n?/g, '').replace(/```/g, '').trim());

      const existing = parsed.existing_skills || [];
      const missing = parsed.missing_skills || [];
      const recommended = parsed.recommended_skills || [];

      // Re-verify existing vs missing deterministically
      const resumeLower = resumeText.toLowerCase();
      const verified = this._verifySkills(resumeLower, existing, missing);

      // Calculate score deterministically from verified counts
      const total = verified.existing.length + verified.missing.length;
      const matchPct = total > 0 ? Math.round((verified.existing.length / total) * 100) : 0;

      return {
        existing_skills: verified.existing,
        missing_skills: verified.missing,
        recommended_skills: recommended,
        skills_match_percentage: matchPct,
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
   * Deterministically verify which skills are present in resume text
   */
  _verifySkills(resumeLower, existingFromAI, missingFromAI) {
    const existing = [];
    const missing = [];
    const seen = new Set();

    const allSkills = [
      ...existingFromAI.map(s => ({ ...s, _aiSaidPresent: true })),
      ...missingFromAI.map(s => ({ ...s, _aiSaidPresent: false })),
    ];

    for (const item of allSkills) {
      const skillName = item.skill || item.skill_name || (typeof item === 'string' ? item : '');
      if (!skillName) continue;

      const skillLower = skillName.toLowerCase().trim();
      if (seen.has(skillLower)) continue;
      seen.add(skillLower);

      // Deterministic check: is this skill in the resume?
      const escaped = skillLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'i');
      const isPresent = regex.test(resumeLower) || resumeLower.includes(skillLower);

      const cleanItem = { ...item };
      delete cleanItem._aiSaidPresent;

      if (isPresent) {
        existing.push(cleanItem);
      } else {
        missing.push(cleanItem);
      }
    }

    return { existing, missing };
  }

  /**
   * Calculate skills match score (0-100) — deterministic
   */
  calculateScore(analysisResult) {
    return Math.min(100, Math.max(0, analysisResult.skills_match_percentage || 0));
  }
}

module.exports = new SkillGapService();
