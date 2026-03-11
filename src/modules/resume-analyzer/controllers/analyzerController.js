const resumeParserService = require('../services/resumeParserService');
const keywordAnalyzerService = require('../services/keywordAnalyzerService');
const skillGapService = require('../services/skillGapService');
const formattingAnalyzerService = require('../services/formattingAnalyzerService');
const aiSuggestionService = require('../services/aiSuggestionService');
const analysisRepository = require('../repositories/analysisRepository');
const resumeRepository = require('../../../repositories/resumeRepository');
const resumeService = require('../../../services/resumeService');

class AnalyzerController {
  /**
   * GET /resume/ats - Render the ATS analyzer dashboard
   */
  async index(req, res) {
    try {
      const history = await analysisRepository.findByUserId(req.session.user.id);
      const resumes = await resumeService.getAll(req.session.user.id);
      const averages = await analysisRepository.getUserAverageScores(req.session.user.id);
      res.render('pages/resume/ats-analyzer', {
        title: 'ATS Resume Analyzer',
        layout: 'layouts/app',
        history,
        resumes,
        averages,
        analysis: null,
      });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  /**
   * POST /api/resume/analyze - Full ATS analysis
   */
  async analyze(req, res) {
    try {
      const userId = req.session.user.id;
      const { resume_id, resumeId, job_description, jobDescription, resumeText } = req.body;
      const jd = job_description || jobDescription;
      const rId = resume_id || resumeId;

      if (!jd || jd.trim().length < 20) {
        return res.status(400).json({ error: 'Job description is required (minimum 20 characters)' });
      }

      // Get resume text - from uploaded file, resume_id, or direct text
      let text = '';
      let parsedResume = {};

      if (req.file) {
        // File uploaded directly
        const ext = require('path').extname(req.file.originalname).toLowerCase();
        text = await resumeParserService.extractText(req.file.buffer, ext);
      } else if (rId) {
        // Get from saved resume
        const resume = await resumeService.getById(rId);
        parsedResume = resume;
        text = this._resumeToText(resume);
      } else if (resumeText) {
        // Direct text input
        text = resumeText;
      } else {
        return res.status(400).json({ error: 'Please provide a resume (file upload, resume ID, or text)' });
      }

      if (text.trim().length < 50) {
        return res.status(400).json({ error: 'Resume content is too short for analysis' });
      }

      const normalizedText = resumeParserService.normalizeText(text);

      // Run all analyses in parallel for performance
      const [keywordResult, skillResult, formatResult, contentResult, experienceResult] = await Promise.all([
        keywordAnalyzerService.analyze(normalizedText, jd),
        skillGapService.analyze(normalizedText, jd),
        formattingAnalyzerService.analyze(normalizedText),
        aiSuggestionService.analyzeContentQuality(normalizedText),
        aiSuggestionService.analyzeExperienceRelevance(normalizedText, jd),
      ]);

      // Calculate individual scores
      const keywordScore = keywordAnalyzerService.calculateScore(keywordResult);
      const skillsScore = skillGapService.calculateScore(skillResult);
      const formattingScore = formattingAnalyzerService.calculateScore(formatResult);
      const contentScore = aiSuggestionService.calculateContentScore(contentResult);
      const experienceScore = aiSuggestionService.calculateExperienceScore(experienceResult);

      // Calculate weighted ATS score
      const atsScore = Math.round(
        keywordScore * 0.40 +
        skillsScore * 0.25 +
        formattingScore * 0.15 +
        contentScore * 0.10 +
        experienceScore * 0.10
      );

      // Generate improvement suggestions
      const suggestions = await aiSuggestionService.generateSuggestions(normalizedText, jd, {
        keywordScore,
        skillsScore,
        formattingScore,
        contentScore,
        experienceScore,
        missingKeywords: keywordResult.missing_keywords.slice(0, 10),
        missingSkills: skillResult.missing_skills.slice(0, 10),
        formatIssues: formatResult.issues.slice(0, 5),
      });

      // Save analysis to database
      const saved = await analysisRepository.createAnalysis({
        userId,
        resumeId: rId || null,
        jobDescription: jd,
        atsScore,
        keywordMatchScore: keywordScore,
        skillsMatchScore: skillsScore,
        formattingScore,
        contentScore,
        experienceScore,
        resumeText: normalizedText,
        parsedResume,
      });

      // Save detailed results
      const allKeywords = [
        ...keywordResult.matched_keywords.map(k => ({ ...k, is_present: true })),
        ...keywordResult.missing_keywords.map(k => ({ ...k, is_present: false })),
      ];

      await Promise.all([
        analysisRepository.saveKeywords(saved.id, allKeywords),
        analysisRepository.saveMissingSkills(saved.id, skillResult.missing_skills),
        analysisRepository.saveFormatIssues(saved.id, formatResult.issues),
        analysisRepository.saveSuggestions(saved.id, this._flattenSuggestions(suggestions)),
      ]);

      // Update resume ATS score if resume_id provided
      if (rId) {
        try { await resumeRepository.updateScore(rId, atsScore); } catch (e) { /* ignore */ }
      }

      // Return comprehensive response
      res.json({
        success: true,
        analysis: {
          id: saved.id,
          ats_score: atsScore,
          keyword_match: keywordScore,
          skills_match: skillsScore,
          formatting_score: formattingScore,
          content_score: contentScore,
          experience_score: experienceScore,
          matched_keywords: keywordResult.matched_keywords,
          missing_keywords: keywordResult.missing_keywords,
          keyword_density: keywordResult.keyword_density,
          existing_skills: skillResult.existing_skills,
          missing_skills: skillResult.missing_skills.map(s => s.skill || s.skill_name),
          recommended_skills: skillResult.recommended_skills,
          formatting_issues: formatResult.issues.map(i => i.description),
          format_details: formatResult,
          content_quality: contentResult,
          experience_relevance: experienceResult,
          suggestions: this._flattenSuggestions(suggestions).map(s => typeof s === 'string' ? s : s.suggestion || s.suggestion_text),
          improvement_details: suggestions,
        },
      });
    } catch (err) {
      console.error('ATS analysis error:', err.message, err.stack);
      res.status(500).json({ error: err.message || 'Analysis failed' });
    }
  }

  /**
   * GET /api/resume/analyze/:id - Get analysis by ID
   */
  async getAnalysis(req, res) {
    try {
      const analysis = await analysisRepository.findById(req.params.id);
      if (!analysis) return res.status(404).json({ error: 'Analysis not found' });
      res.json({ success: true, analysis });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * GET /api/resume/analyze/history - Get user's analysis history
   */
  async getHistory(req, res) {
    try {
      const history = await analysisRepository.findByUserId(req.session.user.id);
      res.json({ success: true, history });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Convert resume object to text for analysis
   */
  _resumeToText(resume) {
    const parts = [];
    const p = resume.profile_data || {};
    if (p.name) parts.push(p.name);
    if (p.headline) parts.push(p.headline);
    if (p.email) parts.push(p.email);
    if (p.phone) parts.push(p.phone);
    if (p.summary) parts.push('Summary: ' + p.summary);

    const skills = resume.skills_data || {};
    if (skills.technical) parts.push('Technical Skills: ' + skills.technical);
    if (skills.tools) parts.push('Tools: ' + skills.tools);
    if (skills.soft) parts.push('Soft Skills: ' + skills.soft);

    const exp = resume.experience_data || [];
    if (exp.length) {
      parts.push('Experience:');
      exp.forEach(e => {
        parts.push(`${e.title || e.role || ''} at ${e.company || ''} (${e.startDate || e.start_date || ''} - ${e.endDate || e.end_date || 'Present'})`);
        if (e.description) parts.push(e.description);
      });
    }

    const edu = resume.education_data || [];
    if (edu.length) {
      parts.push('Education:');
      edu.forEach(e => {
        parts.push(`${e.degree || ''} ${e.field ? 'in ' + e.field : ''} from ${e.institution || ''} (${e.year || ''})`);
      });
    }

    const projects = resume.projects_data || [];
    if (projects.length) {
      parts.push('Projects:');
      projects.forEach(p => {
        parts.push(`${p.name || p.project_name || ''}: ${p.description || ''} (${p.technologies || ''})`);
      });
    }

    const achievements = resume.achievements_data || [];
    if (achievements.length) {
      parts.push('Achievements:');
      achievements.forEach(a => parts.push(typeof a === 'string' ? a : a.achievement_text || ''));
    }

    const certs = resume.certifications_data || [];
    if (certs.length) {
      parts.push('Certifications:');
      certs.forEach(c => parts.push(`${c.name || c.cert_name || ''} - ${c.organization || ''}`));
    }

    return parts.join('\n');
  }

  /**
   * Flatten suggestions from multiple categories into a single array
   */
  _flattenSuggestions(suggestions) {
    const flat = [];
    if (suggestions.formatting_improvements) {
      suggestions.formatting_improvements.forEach(s => flat.push({ suggestion: s.suggestion || s, category: 'formatting', priority: s.priority }));
    }
    if (suggestions.content_improvements) {
      suggestions.content_improvements.forEach(s => flat.push({ suggestion: s.suggestion || s, category: 'content', priority: s.priority }));
    }
    if (suggestions.keyword_suggestions) {
      suggestions.keyword_suggestions.forEach(s => flat.push({ suggestion: `Add keyword "${s.keyword}" in ${s.where_to_add}`, category: 'keyword', priority: 'medium' }));
    }
    if (suggestions.overall_recommendations) {
      suggestions.overall_recommendations.forEach(s => flat.push({ suggestion: typeof s === 'string' ? s : s.suggestion, category: 'general', priority: 'medium' }));
    }
    if (suggestions.missing_sections) {
      suggestions.missing_sections.forEach(s => flat.push({ suggestion: `Add missing section: ${s}`, category: 'structure', priority: 'high' }));
    }
    return flat;
  }
}

module.exports = new AnalyzerController();
