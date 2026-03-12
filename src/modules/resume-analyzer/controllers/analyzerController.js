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
   * POST /resume/ats/api/add-keywords - Add missing keywords/skills to an existing or new resume
   * Supports: keywords → technical, skills → tools, soft_skills → soft
   */
  async addKeywordsToResume(req, res) {
    try {
      const userId = req.session.user.id;
      const { keywords, resume_id, create_new, new_title, section } = req.body;
      // section can be: 'technical' (default), 'tools', 'soft'

      if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
        return res.status(400).json({ error: 'Please select at least one item to add' });
      }

      const targetSection = section || 'technical';

      if (create_new) {
        const skillsObj = { technical: '', soft: '', tools: '', languages: '' };
        skillsObj[targetSection] = keywords.join(', ');
        const newResume = await resumeRepository.create({
          userId,
          title: new_title || 'ATS Optimized Resume',
          profile: {},
          education: [],
          experience: [],
          projects: [],
          skills: skillsObj,
          achievements: [],
          certifications: [],
          languages: [],
          interests: [],
          template: 'modern',
          theme_color: '#0a1a4a',
        });
        return res.json({ success: true, resume_id: newResume.id, message: 'New resume created with selected items', redirect: `/resume/${newResume.id}/edit` });
      }

      if (!resume_id) {
        return res.status(400).json({ error: 'Please select a resume or choose to create a new one' });
      }

      const resume = await resumeService.getById(resume_id);
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      const skills = resume.skills_data || { technical: '', soft: '', tools: '', languages: '' };
      const existingItems = skills[targetSection] ? skills[targetSection].split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
      const newItems = keywords.filter(k => !existingItems.includes(k.toLowerCase().trim()));

      if (newItems.length === 0) {
        return res.json({ success: true, resume_id, message: 'All selected items are already in your resume', redirect: `/resume/${resume_id}/edit` });
      }

      skills[targetSection] = skills[targetSection]
        ? skills[targetSection] + ', ' + newItems.join(', ')
        : newItems.join(', ');

      try { await resumeService.saveVersion(resume_id); } catch (e) { /* ignore */ }
      await resumeService.update(resume_id, { skills_data: skills });

      return res.json({
        success: true,
        resume_id,
        added_keywords: newItems,
        message: `${newItems.length} item${newItems.length > 1 ? 's' : ''} added to your resume`,
        redirect: `/resume/${resume_id}/edit`,
      });
    } catch (err) {
      console.error('Add keywords error:', err.message, err.stack);
      res.status(500).json({ error: err.message || 'Failed to add items' });
    }
  }

  /**
   * POST /resume/ats/api/apply-content - Apply content improvements (weak→strong rewrites) to resume
   */
  async applyContentImprovements(req, res) {
    try {
      const { resume_id, improvements } = req.body;
      // improvements: [{ original: "weak text", improved: "strong text" }]

      if (!resume_id) {
        return res.status(400).json({ error: 'Please select a resume' });
      }
      if (!improvements || !Array.isArray(improvements) || improvements.length === 0) {
        return res.status(400).json({ error: 'No improvements to apply' });
      }

      const resume = await resumeService.getById(resume_id);
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }

      try { await resumeService.saveVersion(resume_id); } catch (e) { /* ignore */ }

      let appliedCount = 0;
      const updateData = {};

      // Apply to experience descriptions
      const experience = resume.experience_data || [];
      if (experience.length) {
        experience.forEach(exp => {
          if (exp.description) {
            improvements.forEach(imp => {
              if (exp.description.includes(imp.original)) {
                exp.description = exp.description.replace(imp.original, imp.improved);
                appliedCount++;
              }
            });
          }
        });
        updateData.experience_data = experience;
      }

      // Apply to summary
      const profile = resume.profile_data || {};
      if (profile.summary) {
        improvements.forEach(imp => {
          if (profile.summary.includes(imp.original)) {
            profile.summary = profile.summary.replace(imp.original, imp.improved);
            appliedCount++;
          }
        });
        updateData.profile_data = profile;
      }

      // Apply to achievements
      const achievements = resume.achievements_data || [];
      if (achievements.length) {
        achievements.forEach((a, i) => {
          const text = typeof a === 'string' ? a : (a.achievement_text || '');
          improvements.forEach(imp => {
            if (text.includes(imp.original)) {
              if (typeof a === 'string') {
                achievements[i] = text.replace(imp.original, imp.improved);
              } else {
                a.achievement_text = text.replace(imp.original, imp.improved);
              }
              appliedCount++;
            }
          });
        });
        updateData.achievements_data = achievements;
      }

      // Apply to project descriptions
      const projects = resume.projects_data || [];
      if (projects.length) {
        projects.forEach(p => {
          if (p.description) {
            improvements.forEach(imp => {
              if (p.description.includes(imp.original)) {
                p.description = p.description.replace(imp.original, imp.improved);
                appliedCount++;
              }
            });
          }
        });
        updateData.projects_data = projects;
      }

      if (Object.keys(updateData).length > 0) {
        await resumeService.update(resume_id, updateData);
      }

      return res.json({
        success: true,
        resume_id,
        applied_count: appliedCount,
        message: appliedCount > 0
          ? `${appliedCount} improvement${appliedCount > 1 ? 's' : ''} applied to your resume`
          : 'Improvements saved. Open your resume to review changes.',
        redirect: `/resume/${resume_id}/edit`,
      });
    } catch (err) {
      console.error('Apply content error:', err.message, err.stack);
      res.status(500).json({ error: err.message || 'Failed to apply improvements' });
    }
  }

  /**
   * POST /resume/ats/api/fix-all - Apply ALL ATS suggestions at once to existing or new resume
   * Handles: missing keywords, missing skills, recommended skills, content rewrites, formatting via AI
   */
  async fixAll(req, res) {
    try {
      const userId = req.session.user.id;
      const { resume_id, create_new, new_title, missing_keywords, missing_skills, recommended_skills, content_improvements, suggestions, job_description } = req.body;

      if (!resume_id && !create_new) {
        return res.status(400).json({ error: 'Please select a resume or choose to create a new one' });
      }

      let resume;
      let targetId = resume_id;
      const results = { skills_added: 0, content_applied: 0, sections_updated: [] };

      if (create_new) {
        // Create new resume with all the skills pre-loaded
        const allSkills = [
          ...(missing_keywords || []),
          ...(missing_skills || []),
          ...(recommended_skills || []),
        ];
        const newResume = await resumeRepository.create({
          userId,
          title: new_title || 'ATS Optimized Resume',
          profile: {},
          education: [],
          experience: [],
          projects: [],
          skills: { technical: allSkills.join(', '), soft: '', tools: '', languages: '' },
          achievements: [],
          certifications: [],
          languages: [],
          interests: [],
          template: 'ats-friendly',
          theme_color: '#0a1a4a',
        });
        targetId = newResume.id;
        results.skills_added = allSkills.length;
        results.sections_updated.push('skills');
        return res.json({
          success: true,
          resume_id: targetId,
          results,
          message: `New ATS-optimized resume created with ${allSkills.length} skills`,
          redirect: `/resume/${targetId}/edit`,
        });
      }

      // Working with existing resume
      resume = await resumeService.getById(targetId);
      if (!resume) return res.status(404).json({ error: 'Resume not found' });

      // Save version before any modifications
      try { await resumeService.saveVersion(targetId); } catch (e) { /* ignore */ }

      const updateData = {};

      // 1. Add all missing keywords + skills + recommended to technical skills
      const allNewSkills = [
        ...(missing_keywords || []),
        ...(missing_skills || []),
        ...(recommended_skills || []),
      ];

      if (allNewSkills.length > 0) {
        const skills = resume.skills_data || { technical: '', soft: '', tools: '', languages: '' };
        const existingTechnical = skills.technical ? skills.technical.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [];
        const newItems = allNewSkills.filter(k => !existingTechnical.includes(k.toLowerCase().trim()));

        if (newItems.length > 0) {
          skills.technical = skills.technical
            ? skills.technical + ', ' + newItems.join(', ')
            : newItems.join(', ');
          updateData.skills_data = skills;
          results.skills_added = newItems.length;
          results.sections_updated.push('skills');
        }
      }

      // 2. Apply content improvements (weak → strong rewrites)
      if (content_improvements && content_improvements.length > 0) {
        // Experience
        const experience = resume.experience_data || [];
        experience.forEach(exp => {
          if (exp.description) {
            content_improvements.forEach(imp => {
              if (exp.description.includes(imp.original)) {
                exp.description = exp.description.replace(imp.original, imp.improved);
                results.content_applied++;
              }
            });
          }
        });
        updateData.experience_data = experience;

        // Summary
        const profile = resume.profile_data || {};
        if (profile.summary) {
          content_improvements.forEach(imp => {
            if (profile.summary.includes(imp.original)) {
              profile.summary = profile.summary.replace(imp.original, imp.improved);
              results.content_applied++;
            }
          });
          updateData.profile_data = profile;
        }

        // Achievements
        const achievements = resume.achievements_data || [];
        achievements.forEach((a, i) => {
          const text = typeof a === 'string' ? a : (a.achievement_text || '');
          content_improvements.forEach(imp => {
            if (text.includes(imp.original)) {
              if (typeof a === 'string') {
                achievements[i] = text.replace(imp.original, imp.improved);
              } else {
                a.achievement_text = text.replace(imp.original, imp.improved);
              }
              results.content_applied++;
            }
          });
        });
        updateData.achievements_data = achievements;

        // Projects
        const projects = resume.projects_data || [];
        projects.forEach(p => {
          if (p.description) {
            content_improvements.forEach(imp => {
              if (p.description.includes(imp.original)) {
                p.description = p.description.replace(imp.original, imp.improved);
                results.content_applied++;
              }
            });
          }
        });
        updateData.projects_data = projects;

        if (results.content_applied > 0) results.sections_updated.push('content');
      }

      // 3. Save all updates
      if (Object.keys(updateData).length > 0) {
        await resumeService.update(targetId, updateData);
      }

      const totalFixes = results.skills_added + results.content_applied;
      return res.json({
        success: true,
        resume_id: targetId,
        results,
        message: totalFixes > 0
          ? `${totalFixes} fix${totalFixes > 1 ? 'es' : ''} applied: ${results.skills_added} skills added, ${results.content_applied} content improvements`
          : 'All suggestions already applied to your resume',
        redirect: `/resume/${targetId}/edit`,
      });
    } catch (err) {
      console.error('Fix all error:', err.message, err.stack);
      res.status(500).json({ error: err.message || 'Failed to apply fixes' });
    }
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
