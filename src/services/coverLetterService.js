const coverLetterRepository = require('../repositories/coverLetterRepository');
const resumeRepository = require('../repositories/resumeRepository');
const { chatCompletion } = require('../config/openai');

const TONE_INSTRUCTIONS = {
  professional: 'Use a polished, professional tone with clear and formal language.',
  confident: 'Use a confident, assertive tone that showcases achievements boldly.',
  enthusiastic: 'Use an enthusiastic, energetic tone showing genuine excitement for the opportunity.',
  formal: 'Use a highly formal, traditional business tone with proper etiquette.',
  concise: 'Use a concise, direct tone. Keep sentences short and impactful.',
};

class CoverLetterService {
  async getAll(userId) {
    return coverLetterRepository.findByUserId(userId);
  }

  async getById(id) {
    return coverLetterRepository.findById(id);
  }

  async generate(userId, data) {
    let resumeText = data.resumeText || '';

    // If resume_id is provided, fetch resume data
    if (data.resumeId && !resumeText) {
      try {
        const resume = await resumeRepository.findById(data.resumeId);
        if (resume) {
          resumeText = this._buildResumeText(resume);
        }
      } catch {
        // Continue without resume data
      }
    }

    const toneInstruction = TONE_INSTRUCTIONS[data.tone] || TONE_INSTRUCTIONS.professional;

    const systemPrompt = `You are a professional career coach and expert cover letter writer.
Your task is to write a tailored, compelling cover letter.

Requirements:
- ${toneInstruction}
- Mention relevant skills from the candidate's background
- Show genuine enthusiasm for the company and role
- Highlight measurable achievements where possible
- Keep the letter concise: 3-4 paragraphs maximum
- Include a proper greeting (Dear Hiring Manager, or Dear [Company] Hiring Team)
- Include a strong opening that hooks the reader
- Include a body that connects candidate skills to job requirements
- Include a closing with a clear call to action
- End with "Sincerely," followed by the candidate's name
- Return ONLY the cover letter text, no extra commentary`;

    const userPrompt = `Write a tailored cover letter for the following:

Company: ${data.companyName}
Position: ${data.jobTitle}
Job Description: ${data.jobDescription || 'Not provided'}
Tone: ${data.tone || 'professional'}

Candidate Resume/Background:
${resumeText || 'Not provided - write a general cover letter based on the job description'}

Important: Incorporate company-specific language and show understanding of the company's mission where possible.`;

    let content;
    try {
      content = await chatCompletion(systemPrompt, userPrompt, { maxTokens: 1500, temperature: 0.7 });
    } catch {
      content = 'AI generation is currently unavailable. Please configure your OPENAI_API_KEY in the .env file to enable AI-powered cover letter generation.';
    }

    const letter = await coverLetterRepository.create({
      userId,
      resumeId: data.resumeId || null,
      title: `${data.companyName} - ${data.jobTitle}`,
      companyName: data.companyName,
      jobTitle: data.jobTitle,
      content,
      jobDescription: data.jobDescription || '',
      tone: data.tone || 'professional',
    });

    // Save job detail
    await coverLetterRepository.createJobDetail({
      coverLetterId: letter.id,
      jobDescription: data.jobDescription || '',
      companyName: data.companyName,
      jobRole: data.jobTitle,
    });

    // Save initial version
    await coverLetterRepository.createVersion({
      coverLetterId: letter.id,
      versionNumber: 1,
      contentSnapshot: content,
    });

    return letter;
  }

  async update(id, data) {
    return coverLetterRepository.update(id, data);
  }

  async delete(id) {
    return coverLetterRepository.delete(id);
  }

  // Save a new version snapshot
  async saveVersion(coverLetterId) {
    const letter = await coverLetterRepository.findById(coverLetterId);
    if (!letter) throw new Error('Cover letter not found');

    const versions = await coverLetterRepository.getVersions(coverLetterId);
    const nextVersion = versions.length > 0 ? versions[0].version_number + 1 : 1;

    await coverLetterRepository.incrementVersion(coverLetterId);

    return coverLetterRepository.createVersion({
      coverLetterId,
      versionNumber: nextVersion,
      contentSnapshot: letter.content,
    });
  }

  // Get version history
  async getVersions(coverLetterId) {
    return coverLetterRepository.getVersions(coverLetterId);
  }

  // Restore a specific version
  async restoreVersion(coverLetterId, versionId) {
    const version = await coverLetterRepository.getVersionById(versionId);
    if (!version || version.cover_letter_id !== coverLetterId) {
      throw new Error('Version not found');
    }
    await coverLetterRepository.update(coverLetterId, { content: version.content_snapshot });
    return { content: version.content_snapshot };
  }

  // Export cover letter as PDF
  async exportPDF(coverLetterId, template) {
    let puppeteer;
    try {
      puppeteer = require('puppeteer');
    } catch {
      throw new Error('Puppeteer not available for PDF export');
    }

    const letter = await coverLetterRepository.findById(coverLetterId);
    if (!letter) throw new Error('Cover letter not found');

    const html = this._renderPDFTemplate(letter, template || 'professional');

    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '25mm', right: '25mm' },
    });
    await browser.close();
    return pdfBuffer;
  }

  // Regenerate cover letter with different tone or updated info
  async regenerate(coverLetterId, userId, data) {
    const existing = await coverLetterRepository.findById(coverLetterId);
    if (!existing) throw new Error('Cover letter not found');

    // Save current version before regenerating
    await this.saveVersion(coverLetterId);

    const newData = {
      companyName: data.companyName || existing.company_name,
      jobTitle: data.jobTitle || existing.job_title,
      jobDescription: data.jobDescription || existing.job_description,
      tone: data.tone || existing.tone || 'professional',
      resumeText: data.resumeText || '',
      resumeId: data.resumeId || existing.resume_id,
    };

    let resumeText = newData.resumeText;
    if (newData.resumeId && !resumeText) {
      try {
        const resume = await resumeRepository.findById(newData.resumeId);
        if (resume) resumeText = this._buildResumeText(resume);
      } catch { /* continue */ }
    }

    const toneInstruction = TONE_INSTRUCTIONS[newData.tone] || TONE_INSTRUCTIONS.professional;

    const systemPrompt = `You are a professional career coach and expert cover letter writer.
${toneInstruction}
Write a tailored, compelling cover letter. 3-4 paragraphs maximum.
Return ONLY the cover letter text.`;

    const userPrompt = `Rewrite this cover letter with the following details:

Company: ${newData.companyName}
Position: ${newData.jobTitle}
Job Description: ${newData.jobDescription || 'Not provided'}
Tone: ${newData.tone}

Candidate Background:
${resumeText || 'Use general professional background'}`;

    let content;
    try {
      content = await chatCompletion(systemPrompt, userPrompt, { maxTokens: 1500, temperature: 0.7 });
    } catch {
      throw new Error('AI generation failed. Please try again.');
    }

    await coverLetterRepository.update(coverLetterId, {
      content,
      tone: newData.tone,
    });

    return { id: coverLetterId, content, tone: newData.tone };
  }

  // Build resume text from structured resume data
  _buildResumeText(resume) {
    const parts = [];
    const parse = (field) => {
      if (!field) return null;
      if (typeof field === 'string') {
        try { return JSON.parse(field); } catch { return null; }
      }
      return field;
    };

    const profile = parse(resume.profile_data);
    if (profile) {
      if (profile.name) parts.push(`Name: ${profile.name}`);
      if (profile.headline) parts.push(`Headline: ${profile.headline}`);
      if (profile.summary) parts.push(`Summary: ${profile.summary}`);
    }

    const skills = parse(resume.skills_data);
    if (skills) {
      const allSkills = [skills.technical, skills.soft, skills.tools].filter(Boolean).join(', ');
      if (allSkills) parts.push(`Skills: ${allSkills}`);
    }

    const experience = parse(resume.experience_data);
    if (Array.isArray(experience) && experience.length) {
      parts.push('Experience:');
      experience.forEach((e) => {
        parts.push(`- ${e.title || e.role || ''} at ${e.company || ''}: ${e.description || ''}`);
      });
    }

    const education = parse(resume.education_data);
    if (Array.isArray(education) && education.length) {
      parts.push('Education:');
      education.forEach((e) => {
        parts.push(`- ${e.degree || ''} in ${e.field || ''} from ${e.institution || ''}`);
      });
    }

    const projects = parse(resume.projects_data);
    if (Array.isArray(projects) && projects.length) {
      parts.push('Projects:');
      projects.forEach((p) => {
        parts.push(`- ${p.name || p.project_name || ''}: ${p.description || ''}`);
      });
    }

    const achievements = parse(resume.achievements_data);
    if (Array.isArray(achievements) && achievements.length) {
      parts.push('Achievements:');
      achievements.forEach((a) => {
        const text = typeof a === 'string' ? a : (a.achievement_text || '');
        if (text) parts.push(`- ${text}`);
      });
    }

    return parts.join('\n');
  }

  // Render PDF HTML template
  _renderPDFTemplate(letter, template) {
    const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const contentHtml = esc(letter.content).replace(/\n/g, '<br>');
    const date = new Date(letter.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const styles = {
      professional: {
        fontFamily: "'Georgia', 'Times New Roman', serif",
        headerColor: '#1a365d',
        textColor: '#2d3748',
        lineHeight: '1.8',
      },
      modern: {
        fontFamily: "'Helvetica Neue', 'Arial', sans-serif",
        headerColor: '#2563eb',
        textColor: '#374151',
        lineHeight: '1.7',
      },
      minimal: {
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        headerColor: '#111827',
        textColor: '#4b5563',
        lineHeight: '1.75',
      },
    };

    const s = styles[template] || styles.professional;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: ${s.fontFamily};
      color: ${s.textColor};
      line-height: ${s.lineHeight};
      font-size: 11pt;
      padding: 0;
    }
    .header {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid ${s.headerColor};
    }
    .header .date { color: #718096; font-size: 10pt; margin-bottom: 8px; }
    .header .company { font-weight: 600; color: ${s.headerColor}; font-size: 11pt; }
    .header .position { color: #718096; font-size: 10pt; font-style: italic; }
    .content { white-space: pre-wrap; word-wrap: break-word; }
    .content br { display: block; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="date">${date}</div>
    <div class="company">${esc(letter.company_name)}</div>
    <div class="position">Re: ${esc(letter.job_title)}</div>
  </div>
  <div class="content">${contentHtml}</div>
</body>
</html>`;
  }
}

module.exports = new CoverLetterService();
