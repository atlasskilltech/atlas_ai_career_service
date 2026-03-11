const resumeRepository = require('../repositories/resumeRepository');
const { chatCompletion } = require('../config/openai');

const JSON_FIELDS = ['profile_data', 'education_data', 'experience_data', 'projects_data', 'skills_data', 'achievements_data', 'certifications_data', 'languages_data', 'interests_data', 'section_order'];

function parseJsonFields(resume) {
  if (!resume) return resume;
  for (const field of JSON_FIELDS) {
    if (resume[field] && typeof resume[field] === 'string') {
      try { resume[field] = JSON.parse(resume[field]); } catch { resume[field] = field.endsWith('_data') && !field.includes('profile') && !field.includes('skills') ? [] : {}; }
    }
  }
  return resume;
}

class ResumeService {
  async getAll(userId) {
    const resumes = await resumeRepository.findByUserId(userId);
    return resumes.map(r => parseJsonFields(r));
  }

  async getById(id) {
    const resume = await resumeRepository.findById(id);
    if (!resume) throw new Error('Resume not found');
    return parseJsonFields(resume);
  }

  async create(userId, data) {
    return resumeRepository.create({ userId, ...data });
  }

  async update(id, data) {
    return resumeRepository.update(id, data);
  }

  async delete(id) {
    return resumeRepository.delete(id);
  }

  async setPrimary(userId, resumeId) {
    return resumeRepository.setPrimary(userId, resumeId);
  }

  async duplicate(id, userId) {
    const original = await this.getById(id);
    return resumeRepository.create({
      userId,
      title: original.title + ' (Copy)',
      profile: original.profile_data,
      education: original.education_data,
      experience: original.experience_data,
      projects: original.projects_data,
      skills: original.skills_data,
      achievements: original.achievements_data,
      certifications: original.certifications_data,
      languages: original.languages_data,
      interests: original.interests_data,
      section_order: original.section_order,
      template: original.template,
      theme_color: original.theme_color,
    });
  }

  // Version History
  async saveVersion(resumeId) {
    const resume = await this.getById(resumeId);
    return resumeRepository.saveVersion(resumeId, resume);
  }

  async getVersions(resumeId) {
    return resumeRepository.getVersions(resumeId);
  }

  async restoreVersion(resumeId, versionId) {
    const version = await resumeRepository.getVersion(versionId);
    if (!version) throw new Error('Version not found');
    let snapshot = version.snapshot_json;
    if (typeof snapshot === 'string') snapshot = JSON.parse(snapshot);
    const updateData = {};
    for (const field of JSON_FIELDS) {
      if (snapshot[field] !== undefined) updateData[field] = snapshot[field];
    }
    if (snapshot.title) updateData.title = snapshot.title;
    if (snapshot.template) updateData.template = snapshot.template;
    if (snapshot.theme_color) updateData.theme_color = snapshot.theme_color;
    await resumeRepository.update(resumeId, updateData);
    return this.getById(resumeId);
  }

  // =================== AI FEATURES ===================

  async generateBulletPoints(experience) {
    try {
      const prompt = `Generate 3-4 impactful resume bullet points for this work experience. Use strong action verbs, quantify achievements where possible, and follow the XYZ formula (Accomplished X, as measured by Y, by doing Z).

Role: ${experience.title || experience.role || ''}
Company: ${experience.company || ''}
Description: ${experience.description || 'N/A'}

Return ONLY the bullet points, one per line, starting with •`;
      return await chatCompletion(
        'You are an expert resume writer for a university career platform. Generate concise, ATS-optimized bullet points that highlight achievements and use metrics.',
        prompt
      );
    } catch {
      return '• Led cross-functional team initiatives resulting in improved project delivery\n• Developed and implemented technical solutions that enhanced system efficiency\n• Collaborated with stakeholders to identify requirements and deliver high-quality results';
    }
  }

  async generateSummary(resumeData) {
    try {
      const prompt = `Generate a professional resume summary (2-3 sentences) based on:
Name: ${resumeData.name || 'N/A'}
Skills: ${resumeData.skills || 'N/A'}
Experience: ${resumeData.experience || 'N/A'}
Education: ${resumeData.education || 'N/A'}
Target Role: ${resumeData.targetRole || 'N/A'}

Return ONLY the summary text, no labels or prefixes.`;
      return await chatCompletion(
        'You are an expert resume writer. Create compelling professional summaries that highlight key strengths and career objectives. Keep it under 50 words.',
        prompt
      );
    } catch {
      return 'Results-driven professional with strong technical skills and a passion for delivering innovative solutions. Proven track record of collaborating with cross-functional teams to achieve project goals.';
    }
  }

  async rewriteAchievement(achievement) {
    try {
      const prompt = `Rewrite this achievement to be more impactful for a resume. Use strong action verbs, add metrics if possible, and make it concise:

"${achievement}"

Return ONLY the rewritten achievement, nothing else.`;
      return await chatCompletion(
        'You are an expert resume writer specializing in achievement-focused bullet points.',
        prompt
      );
    } catch {
      return achievement;
    }
  }

  async generateProjectDescription(project) {
    try {
      const prompt = `Write a concise, professional project description (2-3 lines) for a resume:

Project: ${project.name || ''}
Technologies: ${project.technologies || ''}
Description: ${project.description || 'N/A'}

Focus on impact, technologies used, and outcomes. Return ONLY the description text.`;
      return await chatCompletion(
        'You are an expert resume writer. Create professional project descriptions that highlight technical skills and impact.',
        prompt
      );
    } catch {
      return project.description || '';
    }
  }

  async suggestSkills(data) {
    try {
      const prompt = `Based on this resume information, suggest 10-15 relevant technical and soft skills:

Role/Target: ${data.role || 'N/A'}
Experience: ${data.experience || 'N/A'}
Current Skills: ${data.currentSkills || 'N/A'}
Projects: ${data.projects || 'N/A'}

Return as JSON: {"technical": ["skill1", "skill2"], "soft": ["skill1", "skill2"], "tools": ["tool1", "tool2"]}`;
      const result = await chatCompletion(
        'You are a career advisor. Suggest relevant, in-demand skills for the given profile.',
        prompt
      );
      return JSON.parse(result.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    } catch {
      return { technical: ['JavaScript', 'Python', 'SQL'], soft: ['Communication', 'Leadership', 'Problem Solving'], tools: ['Git', 'VS Code', 'Docker'] };
    }
  }

  async analyzeATS(resumeData, jobDescription) {
    try {
      const prompt = `Analyze this resume against the job description for ATS compatibility.

RESUME:
${JSON.stringify(resumeData, null, 2).substring(0, 3000)}

JOB DESCRIPTION:
${jobDescription}

Return JSON:
{
  "score": <0-100>,
  "matchedKeywords": ["keyword1", "keyword2"],
  "missingKeywords": ["keyword1", "keyword2"],
  "suggestions": ["suggestion1", "suggestion2"],
  "sectionFeedback": {
    "summary": "feedback",
    "experience": "feedback",
    "skills": "feedback",
    "education": "feedback"
  }
}`;
      const result = await chatCompletion(
        'You are an ATS (Applicant Tracking System) expert. Analyze resumes for keyword optimization and ATS compatibility.',
        prompt,
        { maxTokens: 2000 }
      );
      const parsed = JSON.parse(result.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
      if (resumeData.id) {
        await resumeRepository.updateScore(resumeData.id, parsed.score || 0);
      }
      return parsed;
    } catch {
      return { score: 0, matchedKeywords: [], missingKeywords: [], suggestions: ['AI analysis unavailable. Please configure OPENAI_API_KEY.'], sectionFeedback: {} };
    }
  }

  // =================== PDF EXPORT ===================
  async exportPDF(resumeId) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('Puppeteer not available for PDF export');
    }
    const resume = await this.getById(resumeId);
    const html = this.renderTemplate(resume);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });
    await browser.close();
    return pdfBuffer;
  }

  renderTemplate(resume) {
    const template = resume.template || 'modern';
    const color = resume.theme_color || '#0a1a4a';
    const profile = resume.profile_data || {};
    const education = resume.education_data || [];
    const experience = resume.experience_data || [];
    const projects = resume.projects_data || [];
    const skills = resume.skills_data || {};
    const achievements = resume.achievements_data || [];
    const certifications = resume.certifications_data || [];
    const languages = resume.languages_data || [];
    const interests = resume.interests_data || [];
    const sectionOrder = resume.section_order || ['profile','education','experience','projects','skills','achievements','certifications','languages','interests'];

    const esc = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

    function h2(title) { return '<h2 style="color:' + color + '">' + title + '</h2>'; }

    const renderSection = (key) => {
      switch (key) {
        case 'profile': return '';
        case 'education':
          if (!education.length) return '';
          return h2('EDUCATION') + education.map(function(e) {
            var yr = e.year || (e.start_year && e.end_year ? e.start_year + ' - ' + e.end_year : '');
            var sub = esc(e.degree) + (e.field ? ' in ' + esc(e.field) : '') + (e.gpa || e.cgpa ? ' | GPA: ' + esc(e.gpa || e.cgpa) : '');
            return '<div class="entry"><div class="entry-header"><span>' + esc(e.institution) + '</span><span>' + esc(yr) + '</span></div><div class="entry-sub">' + sub + '</div></div>';
          }).join('');
        case 'experience':
          if (!experience.length) return '';
          return h2('EXPERIENCE') + experience.map(function(e) {
            var loc = e.location ? '<div class="entry-sub">' + esc(e.location) + '</div>' : '';
            return '<div class="entry"><div class="entry-header"><span>' + esc(e.title || e.role) + ' — ' + esc(e.company) + '</span><span>' + esc(e.startDate || e.start_date || '') + ' - ' + esc(e.endDate || e.end_date || 'Present') + '</span></div>' + loc + '<div class="entry-desc">' + esc(e.description) + '</div></div>';
          }).join('');
        case 'projects':
          if (!projects.length) return '';
          return h2('PROJECTS') + projects.map(function(p) {
            var link = (p.url || p.github_link) ? '<div class="entry-sub">' + esc(p.url || p.github_link) + '</div>' : '';
            return '<div class="entry"><div class="entry-header"><span>' + esc(p.name || p.project_name) + '</span><span>' + esc(p.technologies) + '</span></div><div class="entry-desc">' + esc(p.description) + '</div>' + link + '</div>';
          }).join('');
        case 'skills':
          if (!(skills.technical || skills.soft || skills.tools || skills.languages)) return '';
          var sg = '';
          if (skills.technical) sg += '<div><span class="skill-cat">Technical:</span> ' + esc(skills.technical) + '</div>';
          if (skills.tools) sg += '<div><span class="skill-cat">Tools:</span> ' + esc(skills.tools) + '</div>';
          if (skills.soft) sg += '<div><span class="skill-cat">Soft Skills:</span> ' + esc(skills.soft) + '</div>';
          if (skills.languages) sg += '<div><span class="skill-cat">Languages:</span> ' + esc(skills.languages) + '</div>';
          return h2('SKILLS') + '<div class="skills-grid">' + sg + '</div>';
        case 'achievements':
          if (!achievements.length) return '';
          return h2('ACHIEVEMENTS') + '<ul>' + achievements.map(function(a) {
            var text = typeof a === 'string' ? a : (a.achievement_text || '');
            return '<li>' + esc(text) + '</li>';
          }).join('') + '</ul>';
        case 'certifications':
          if (!certifications.length) return '';
          return h2('CERTIFICATIONS') + '<ul>' + certifications.map(function(c) {
            var org = c.organization ? ' — ' + esc(c.organization) : '';
            var dt = (c.date || c.issue_date) ? ' (' + esc(c.date || c.issue_date) + ')' : '';
            return '<li><strong>' + esc(c.name || c.cert_name) + '</strong>' + org + dt + '</li>';
          }).join('') + '</ul>';
        case 'languages':
          if (!languages.length) return '';
          return h2('LANGUAGES') + '<div class="skills-grid">' + languages.map(function(l) {
            return '<div>' + esc(l.language || l.name) + ' — ' + esc(l.proficiency || l.level || '') + '</div>';
          }).join('') + '</div>';
        case 'interests':
          if (!interests.length) return '';
          return h2('INTERESTS') + '<p>' + interests.map(function(i) { return esc(typeof i === 'string' ? i : (i.name || '')); }).join(', ') + '</p>';
        default: return '';
      }
    };

    const sectionsHTML = sectionOrder.map(renderSection).filter(Boolean).join('');
    const contactParts = [profile.email, profile.phone, profile.location, profile.linkedin, profile.website || profile.portfolio || profile.github].filter(Boolean);

    var fontFamily = template === 'professional' ? '"Georgia",serif' : template === 'minimal' ? '"Helvetica Neue","Arial",sans-serif' : '"Calibri","Segoe UI",sans-serif';
    var textAlign = template === 'professional' ? 'left' : 'center';
    var h1Size = template === 'minimal' ? '22px' : '26px';
    var h1Color = template === 'minimal' ? '#333' : color;
    var h1Letter = template === 'professional' ? '2px' : '0';
    var h1Transform = template === 'professional' ? 'uppercase' : 'none';
    var bodyPad = template === 'ats' ? '30px 40px' : '30px 36px';
    var summaryExtra = template === 'professional' ? 'border-left:3px solid ' + color + ';padding-left:12px;' : '';
    var h2Border = template === 'minimal' ? '1px solid #ddd' : template === 'ats' ? '1px solid #333' : '2px solid ' + color;
    var h2Color = template === 'minimal' ? '#555' : color;
    var h2Weight = template === 'minimal' ? '600' : '700';
    var headlineHtml = profile.headline ? '<div class="headline">' + esc(profile.headline) + '</div>' : '';
    var summaryHtml = profile.summary ? '<div class="summary">' + esc(profile.summary) + '</div>' : '';

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:' + fontFamily + ';color:#333;line-height:1.5;padding:' + bodyPad + ';max-width:800px;margin:0 auto;font-size:13px}' +
      'h1{font-size:' + h1Size + ';text-align:' + textAlign + ';margin-bottom:2px;color:' + h1Color + ';letter-spacing:' + h1Letter + ';text-transform:' + h1Transform + '}' +
      '.headline{text-align:' + textAlign + ';font-size:13px;color:#555;margin-bottom:2px;font-style:italic}' +
      '.contact{text-align:' + textAlign + ';font-size:11px;color:#666;margin-bottom:12px}' +
      '.summary{font-size:12px;color:#444;margin-bottom:14px;' + summaryExtra + '}' +
      'h2{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:' + h2Border + ';padding-bottom:3px;margin:14px 0 8px;color:' + h2Color + ';font-weight:' + h2Weight + '}' +
      '.entry{margin-bottom:10px}.entry-header{display:flex;justify-content:space-between;font-weight:600;font-size:13px}' +
      '.entry-sub{font-style:italic;font-size:11px;color:#555}.entry-desc{font-size:12px;margin-top:2px;white-space:pre-line}' +
      '.skills-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px}.skill-cat{font-weight:600}' +
      'ul{padding-left:18px;font-size:12px}li{margin-bottom:3px}p{font-size:12px}' +
      '@media print{body{padding:15px 20px}}' +
      '</style></head><body>' +
      '<h1>' + esc(profile.name || profile.full_name || 'Your Name') + '</h1>' +
      headlineHtml +
      '<div class="contact">' + contactParts.join(' | ') + '</div>' +
      summaryHtml +
      sectionsHTML +
      '</body></html>';
  }
}

module.exports = new ResumeService();
