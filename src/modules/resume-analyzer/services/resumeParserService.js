const pdfParse = require('pdf-parse');

class ResumeParserService {
  /**
   * Extract text from resume buffer (PDF or DOCX)
   */
  async extractText(buffer, ext) {
    ext = (ext || '').toLowerCase();

    if (ext === '.pdf') {
      const pdfData = await Promise.race([
        pdfParse(buffer),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF parsing timed out')), 10000)),
      ]);
      return pdfData.text || '';
    }

    if (ext === '.docx') {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(buffer);
      const docEntry = zip.getEntry('word/document.xml');
      if (docEntry) {
        const xmlContent = docEntry.getData().toString('utf8');
        return xmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      }
      throw new Error('Could not extract text from DOCX file.');
    }

    throw new Error('Unsupported file format. Please upload a PDF or DOCX file.');
  }

  /**
   * Convert resume text into structured JSON
   */
  parseStructure(text) {
    const sections = {
      skills: [],
      experience: [],
      education: [],
      projects: [],
      certifications: [],
      summary: '',
      contact: {},
    };

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let currentSection = '';

    const sectionPatterns = {
      skills: /^(skills|technical\s+skills|core\s+competencies|technologies)/i,
      experience: /^(experience|work\s+experience|professional\s+experience|employment)/i,
      education: /^(education|academic|qualification)/i,
      projects: /^(projects|personal\s+projects|key\s+projects)/i,
      certifications: /^(certifications?|licenses?|credentials)/i,
      summary: /^(summary|objective|profile|about)/i,
    };

    for (const line of lines) {
      let matched = false;
      for (const [section, pattern] of Object.entries(sectionPatterns)) {
        if (pattern.test(line)) {
          currentSection = section;
          matched = true;
          break;
        }
      }
      if (matched) continue;

      if (currentSection === 'skills') {
        const skills = line.split(/[,|•·●▪▸►–-]/).map(s => s.trim()).filter(s => s.length > 1);
        sections.skills.push(...skills);
      } else if (currentSection === 'experience') {
        sections.experience.push(line);
      } else if (currentSection === 'education') {
        sections.education.push(line);
      } else if (currentSection === 'projects') {
        sections.projects.push(line);
      } else if (currentSection === 'certifications') {
        sections.certifications.push(line);
      } else if (currentSection === 'summary') {
        sections.summary += (sections.summary ? ' ' : '') + line;
      }
    }

    // Extract contact info from top of resume
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    const phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/);
    if (emailMatch) sections.contact.email = emailMatch[0];
    if (phoneMatch) sections.contact.phone = phoneMatch[0];

    // Deduplicate skills
    sections.skills = [...new Set(sections.skills)];

    return sections;
  }

  /**
   * Extract all text content as a flat string (for AI analysis)
   */
  normalizeText(text) {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s.,;:!?@#$%&*()\-+=[\]{}|/\\'"<>]/g, '')
      .trim()
      .substring(0, 8000);
  }
}

module.exports = new ResumeParserService();
