const resumeRepository = require('../repositories/resumeRepository');
const { chatCompletion } = require('../config/openai');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

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

  // Step 1: Extract text from buffer or file (fast, no AI)
  async extractTextFromResume(bufferOrPath, ext) {
    var text = '';
    var dataBuffer;

    // Support both Buffer (memory upload) and file path (legacy)
    if (Buffer.isBuffer(bufferOrPath)) {
      dataBuffer = bufferOrPath;
    } else {
      dataBuffer = fs.readFileSync(bufferOrPath);
      ext = ext || path.extname(bufferOrPath).toLowerCase();
      // Clean up file after reading
      try { fs.unlinkSync(bufferOrPath); } catch(e) {}
    }
    ext = (ext || '').toLowerCase();

    if (ext === '.pdf') {
      var pdfData = await Promise.race([
        pdfParse(dataBuffer),
        new Promise(function(_, reject) {
          setTimeout(function() { reject(new Error('PDF parsing timed out')); }, 10000);
        })
      ]);
      text = pdfData.text;
    } else if (ext === '.docx') {
      var AdmZip = require('adm-zip');
      var zip = new AdmZip(dataBuffer);
      var docEntry = zip.getEntry('word/document.xml');
      if (docEntry) {
        var xmlContent = docEntry.getData().toString('utf8');
        // Preserve paragraph/line breaks by replacing closing paragraph/break tags with newlines
        text = xmlContent
          .replace(/<\/w:p>/g, '\n')
          .replace(/<w:br[^>]*\/>/g, '\n')
          .replace(/<w:tab[^>]*\/>/g, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/[ \t]+/g, ' ')
          .replace(/\n /g, '\n')
          .replace(/\n{3,}/g, '\n\n')
          .trim();
      }
      if (!text || text.length < 20) {
        throw new Error('Could not extract text from DOCX file.');
      }
    } else if (ext === '.doc') {
      var content = dataBuffer.toString('utf8');
      text = content.replace(/[\x00-\x1f]/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!text || text.length < 20) {
        throw new Error('Legacy .doc format not fully supported. Please convert to PDF or DOCX.');
      }
    } else {
      throw new Error('Unsupported file format. Please upload a PDF or DOCX file.');
    }

    if (!text || text.trim().length < 20) {
      throw new Error('Could not extract text from the uploaded file. Please try a different file.');
    }

    text = text.substring(0, 8000);
    return { text };
  }

  // Step 2: Parse extracted text with AI
  async parseResumeTextWithAI(text) {
    var systemPrompt = `You are an expert resume parser. Your ONLY job is to extract ALL structured data from the resume text.

CRITICAL RULES:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Extract EVERY piece of information present in the resume
3. For experience descriptions, include ALL bullet points and details
4. For skills, categorize them properly (technical vs soft vs tools)
5. If a section exists in the resume, you MUST extract it - do not skip any section
6. For dates, preserve the original format (e.g., "Jan 2020 - Present", "2019-2023")

Return this EXACT JSON structure:
{
  "name": "full name",
  "headline": "job title or professional headline",
  "email": "email address",
  "phone": "phone number with country code",
  "linkedin": "linkedin URL or username",
  "github": "github URL or username",
  "website": "portfolio or personal website URL",
  "location": "city, state/country",
  "summary": "professional summary or objective (full text)",
  "education": [{"institution":"school name","degree":"degree type","field":"field of study","year":"year or date range","gpa":"GPA/CGPA/percentage if mentioned"}],
  "experience": [{"title":"job title","company":"company name","location":"job location","startDate":"start date","endDate":"end date or Present","description":"full description with all bullet points joined by newlines"}],
  "projects": [{"name":"project name","technologies":"comma separated tech used","description":"project description","url":"project URL if any"}],
  "skills": {"technical":"comma separated technical/programming skills","soft":"comma separated soft skills","tools":"comma separated tools/software/platforms","languages":"comma separated programming languages"},
  "achievements": ["achievement 1", "achievement 2"],
  "certifications": [{"name":"cert name","organization":"issuing org","date":"date"}],
  "languages": [{"language":"language name","proficiency":"proficiency level"}],
  "interests": ["interest 1", "interest 2"]
}`;

    var result = await chatCompletion(systemPrompt, 'Extract ALL data from this resume:\n\n' + text, { maxTokens: 4000, temperature: 0.2, timeout: 30000 });

    // Clean AI response - handle various formatting issues
    result = result.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Remove any leading text before the JSON object
    var jsonStart = result.indexOf('{');
    var jsonEnd = result.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      result = result.substring(jsonStart, jsonEnd + 1);
    }

    var parsed;
    try {
      parsed = JSON.parse(result);
    } catch (jsonErr) {
      // Try to fix common JSON issues: trailing commas, single quotes
      var fixed = result.replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"');
      parsed = JSON.parse(fixed);
    }

    return {
      profile_data: {
        name: parsed.name || '',
        headline: parsed.headline || '',
        email: parsed.email || '',
        phone: parsed.phone || '',
        linkedin: parsed.linkedin || '',
        github: parsed.github || '',
        website: parsed.website || '',
        location: parsed.location || '',
        summary: parsed.summary || '',
      },
      education_data: Array.isArray(parsed.education) ? parsed.education : [],
      experience_data: Array.isArray(parsed.experience) ? parsed.experience : [],
      projects_data: Array.isArray(parsed.projects) ? parsed.projects : [],
      skills_data: parsed.skills && typeof parsed.skills === 'object'
        ? {
            technical: parsed.skills.technical || '',
            soft: parsed.skills.soft || '',
            tools: parsed.skills.tools || '',
            languages: parsed.skills.languages || '',
          }
        : { technical: '', soft: '', tools: '', languages: '' },
      achievements_data: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      certifications_data: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      languages_data: Array.isArray(parsed.languages) ? parsed.languages : [],
      interests_data: Array.isArray(parsed.interests) ? parsed.interests : [],
    };
  }

  // Regex-based fallback (public, used by controller)
  extractResumeFromText(text) {
    return this._extractResumeFromText(text);
  }

  // Legacy method for backward compatibility
  async parseUploadedResume(filePath) {
    var extractResult = await this.extractTextFromResume(filePath);
    try {
      return await this.parseResumeTextWithAI(extractResult.text);
    } catch(aiError) {
      console.error('AI parsing failed, using regex fallback:', aiError.message);
      return this._extractResumeFromText(extractResult.text);
    }
  }

  _extractResumeFromText(text) {
    var emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    var phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}/);
    var linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
    var githubMatch = text.match(/github\.com\/[\w-]+/i);
    var websiteMatch = text.match(/(?:https?:\/\/)?(?:www\.)?[\w-]+\.(?:com|io|dev|org|net|in|co)(?:\/[\w-]*)?/i);

    var lines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });

    // --- Name extraction (first few lines, before any section header) ---
    var name = '';
    var headline = '';
    for (var i = 0; i < Math.min(8, lines.length); i++) {
      var line = lines[i];
      if (this._isSectionHeader(line)) break;
      // Skip lines that are just URLs, emails, or phone numbers
      if (/^[\w.+-]+@/.test(line) || /linkedin|github|http/i.test(line)) continue;
      if (/^\+?\d[\d\s()\-+.]{7,}$/.test(line)) continue;
      if (!name && line.length > 2 && line.length < 60 && /^[A-Za-z\s.'-]+$/.test(line) && line.split(/\s+/).length >= 2 && line.split(/\s+/).length <= 5) {
        name = line;
        continue;
      }
      // Line after name could be headline/title
      if (name && !headline && line.length > 2 && line.length < 80 && !(/^\+?\d/.test(line)) && !(/@/.test(line))) {
        headline = line;
      }
    }

    // --- Location extraction ---
    var location = '';
    var locationMatch = text.match(/(?:location|address|city|based in)[:\s]*([^\n]+)/i);
    if (locationMatch) {
      location = locationMatch[1].trim();
    } else {
      // Try common location patterns in first 10 lines: "City, State" or "City, Country"
      for (var li = 0; li < Math.min(10, lines.length); li++) {
        var locLine = lines[li];
        if (this._isSectionHeader(locLine)) break;
        var locM = locLine.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*|[A-Z]{2})\s*(?:\d{5,6})?$/);
        if (locM && locLine.length < 60 && !locLine.includes('@')) {
          location = locM[0].trim();
          break;
        }
      }
    }

    // --- Section splitting ---
    var sections = this._splitIntoSections(lines);

    // --- Summary / Objective ---
    var summary = '';
    var summarySection = sections['summary'] || sections['objective'] || sections['profile'] || sections['about'] || sections['professional summary'] || sections['career objective'] || sections['about me'] || [];
    if (summarySection.length > 0) {
      summary = summarySection.join(' ').substring(0, 500);
    }

    // --- Education ---
    var education_data = [];
    var eduSection = sections['education'] || sections['academic'] || sections['academic profile'] || sections['academics'] || sections['educational qualification'] || sections['educational qualifications'] || sections['qualification'] || sections['qualifications'] || [];
    if (eduSection.length > 0) {
      education_data = this._parseEducation(eduSection);
    }

    // --- Experience ---
    var experience_data = [];
    var expSection = sections['experience'] || sections['work experience'] || sections['professional experience'] || sections['employment'] || sections['employment history'] || sections['work history'] || sections['internship'] || sections['internships'] || [];
    if (expSection.length > 0) {
      experience_data = this._parseExperience(expSection);
    }

    // --- Projects ---
    var projects_data = [];
    var projSection = sections['projects'] || sections['project'] || sections['personal projects'] || sections['academic projects'] || sections['key projects'] || [];
    if (projSection.length > 0) {
      projects_data = this._parseProjects(projSection);
    }

    // --- Skills ---
    var skills_data = { technical: '', soft: '', tools: '', languages: '' };
    var skillSection = sections['skills'] || sections['technical skills'] || sections['key skills'] || sections['core competencies'] || sections['competencies'] || sections['areas of expertise'] || sections['expertise'] || [];
    if (skillSection.length > 0) {
      skills_data = this._parseSkills(skillSection);
    }

    // --- Achievements ---
    var achievements_data = [];
    var achSection = sections['achievements'] || sections['accomplishments'] || sections['honors'] || sections['awards'] || sections['honors and awards'] || sections['honours'] || [];
    if (achSection.length > 0) {
      achievements_data = achSection.filter(function(l) { return l.length > 3; }).map(function(l) { return l.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim(); }).filter(Boolean);
    }

    // --- Certifications ---
    var certifications_data = [];
    var certSection = sections['certifications'] || sections['certificates'] || sections['certification'] || sections['professional certifications'] || sections['licenses'] || [];
    if (certSection.length > 0) {
      certifications_data = this._parseCertifications(certSection);
    }

    // --- Languages ---
    var languages_data = [];
    var langSection = sections['languages'] || sections['language'] || sections['language skills'] || [];
    if (langSection.length > 0) {
      languages_data = this._parseLanguages(langSection);
    }

    // --- Interests ---
    var interests_data = [];
    var intSection = sections['interests'] || sections['hobbies'] || sections['hobbies and interests'] || sections['extracurricular'] || sections['extracurricular activities'] || [];
    if (intSection.length > 0) {
      interests_data = intSection.join(', ').split(/[,;•\-\u2022]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 1; });
    }

    // Filter out website that matches linkedin or github
    var website = '';
    if (websiteMatch) {
      var w = websiteMatch[0];
      if ((!linkedinMatch || w !== linkedinMatch[0]) && (!githubMatch || w !== githubMatch[0])) website = w;
    }

    return {
      profile_data: {
        name: name,
        headline: headline,
        email: emailMatch ? emailMatch[0] : '',
        phone: phoneMatch ? phoneMatch[0] : '',
        linkedin: linkedinMatch ? linkedinMatch[0] : '',
        github: githubMatch ? githubMatch[0] : '',
        website: website,
        location: location,
        summary: summary,
      },
      education_data: education_data,
      experience_data: experience_data,
      projects_data: projects_data,
      skills_data: skills_data,
      achievements_data: achievements_data,
      certifications_data: certifications_data,
      languages_data: languages_data,
      interests_data: interests_data,
    };
  }

  // Check if a line is a section header
  _isSectionHeader(line) {
    var cleaned = line.replace(/[:\-–—_|#*=]+$/g, '').trim().toLowerCase();
    var headers = [
      'education', 'academic', 'academics', 'academic profile', 'qualification', 'qualifications',
      'educational qualification', 'educational qualifications',
      'experience', 'work experience', 'professional experience', 'employment',
      'employment history', 'work history', 'internship', 'internships',
      'projects', 'project', 'personal projects', 'academic projects', 'key projects',
      'skills', 'technical skills', 'key skills', 'core competencies', 'competencies',
      'areas of expertise', 'expertise',
      'achievements', 'accomplishments', 'honors', 'awards', 'honors and awards', 'honours',
      'certifications', 'certificates', 'certification', 'professional certifications', 'licenses',
      'languages', 'language', 'language skills',
      'interests', 'hobbies', 'hobbies and interests',
      'extracurricular', 'extracurricular activities',
      'summary', 'objective', 'profile', 'about', 'professional summary',
      'career objective', 'about me', 'contact', 'personal details', 'personal information',
      'references', 'declaration', 'publications', 'volunteer', 'volunteering',
    ];
    return headers.includes(cleaned);
  }

  // Split text lines into sections based on headers
  _splitIntoSections(lines) {
    var sections = {};
    var currentSection = '_header';
    sections[currentSection] = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (this._isSectionHeader(line)) {
        currentSection = line.replace(/[:\-–—_|#*=]+$/g, '').trim().toLowerCase();
        if (!sections[currentSection]) sections[currentSection] = [];
      } else {
        if (!sections[currentSection]) sections[currentSection] = [];
        sections[currentSection].push(line);
      }
    }
    return sections;
  }

  // Parse education section lines into structured data
  _parseEducation(lines) {
    var entries = [];
    var current = null;
    var degreePatterns = /\b(B\.?Tech|M\.?Tech|B\.?E|M\.?E|B\.?Sc|M\.?Sc|B\.?A|M\.?A|B\.?Com|M\.?Com|B\.?C\.?A|M\.?C\.?A|B\.?B\.?A|M\.?B\.?A|Ph\.?D|Diploma|Bachelor|Master|Associate|Doctor|BSc|MSc|BA|MA|BS|MS|BE|ME|BCA|MCA|BBA|MBA|B\.S|M\.S|XII|12th|X|10th|HSC|SSC|CBSE|ICSE|Higher Secondary|Secondary|High School|Intermediate)\b/i;
    var yearPattern = /\b(19|20)\d{2}\b/;
    var gpaPattern = /(?:GPA|CGPA|Percentage|Score|Grade)[:\s]*([0-9]+\.?[0-9]*\s*(?:\/\s*(?:10|4|100))?%?)/i;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cleanLine = line.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim();
      if (!cleanLine) continue;

      var hasDegree = degreePatterns.test(cleanLine);
      var hasYear = yearPattern.test(cleanLine);
      // Heuristic: a new education entry starts with a degree keyword or an institution-like line
      // (capitalized, longer text that isn't a sub-detail)
      var looksLikeInstitution = /^[A-Z]/.test(cleanLine) && cleanLine.length > 10 && !gpaPattern.test(cleanLine);

      if (hasDegree || (looksLikeInstitution && (!current || (current && current.degree)))) {
        if (current) entries.push(current);
        current = { institution: '', degree: '', field: '', year: '', gpa: '' };

        // Try to extract degree and field
        if (hasDegree) {
          var degMatch = cleanLine.match(degreePatterns);
          if (degMatch) {
            current.degree = degMatch[0];
            // Field is often after "in" or after the degree
            var fieldMatch = cleanLine.match(/\bin\s+(.+?)(?:\s*[\(\|,]|\s*\d{4}|$)/i);
            if (fieldMatch) current.field = fieldMatch[1].trim();
          }
          // Institution might be on this line or a separate line
          var instPart = cleanLine.replace(degreePatterns, '').replace(/\bin\s+.+$/, '').replace(/[,|–\-]+/g, ' ').trim();
          if (instPart.length > 3) current.institution = instPart;
        } else {
          current.institution = cleanLine;
        }
      } else if (current) {
        // Add details to current entry
        if (!current.institution && looksLikeInstitution) {
          current.institution = cleanLine;
        } else if (hasDegree && !current.degree) {
          var dMatch = cleanLine.match(degreePatterns);
          if (dMatch) current.degree = dMatch[0];
          var fMatch = cleanLine.match(/\bin\s+(.+?)(?:\s*[\(\|,]|\s*\d{4}|$)/i);
          if (fMatch && !current.field) current.field = fMatch[1].trim();
        }
      }

      // Extract year from any line in current entry
      if (current) {
        var years = cleanLine.match(/\b((?:19|20)\d{2})\s*[\-–to]*\s*((?:19|20)\d{2}|Present|Current|Ongoing|Till Date|Expected)?\b/gi);
        if (years && !current.year) {
          current.year = years[years.length - 1].trim();
        }
        var gMatch = cleanLine.match(gpaPattern);
        if (gMatch && !current.gpa) {
          current.gpa = gMatch[1].trim();
        }
      }
    }
    if (current && (current.institution || current.degree)) entries.push(current);
    return entries;
  }

  // Parse experience section lines into structured data
  _parseExperience(lines) {
    var entries = [];
    var current = null;
    var datePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)\s*\.?\s*\d{0,4}\s*[\-–to]*\s*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|May|June|July|August|September|October|November|December)?\s*\.?\s*\d{0,4}|(?:19|20)\d{2}\s*[\-–to]*\s*(?:(?:19|20)\d{2}|Present|Current|Till Date|Ongoing)/i;
    var titleKeywords = /\b(engineer|developer|designer|manager|analyst|consultant|intern|lead|director|associate|coordinator|specialist|architect|administrator|assistant|executive|officer|head|senior|junior|trainee|fellow|researcher)\b/i;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cleanLine = line.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim();
      if (!cleanLine) continue;

      var hasDate = datePattern.test(cleanLine);
      var hasTitle = titleKeywords.test(cleanLine);
      var isBullet = /^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]/.test(line.trim());

      // New entry: line with a job title or line with dates at beginning of a block
      if ((hasTitle && !isBullet) || (hasDate && !isBullet && cleanLine.length < 120 && /^[A-Z]/.test(cleanLine))) {
        if (current) entries.push(current);
        current = { title: '', company: '', location: '', startDate: '', endDate: '', description: '' };

        // Extract dates
        var dMatch = cleanLine.match(datePattern);
        if (dMatch) {
          var dateParts = dMatch[0].split(/\s*[\-–]\s*|\s*to\s*/i);
          current.startDate = (dateParts[0] || '').trim();
          current.endDate = (dateParts[1] || '').trim();
        }

        // Try to parse "Title at Company" or "Title | Company" or "Title, Company"
        var lineWithoutDate = cleanLine.replace(datePattern, '').trim();
        var separators = lineWithoutDate.match(/^(.+?)(?:\s+at\s+|\s*[\|–\-]\s*|\s*,\s+)(.+)$/i);
        if (separators) {
          current.title = separators[1].trim().replace(/[,|]+$/, '').trim();
          current.company = separators[2].trim().replace(/[,|]+$/, '').trim();
        } else if (hasTitle) {
          current.title = lineWithoutDate.replace(/[,|]+$/, '').trim();
        } else {
          current.company = lineWithoutDate.replace(/[,|]+$/, '').trim();
        }
      } else if (current) {
        // Check if this line is company name (if we only have title)
        if (!current.company && !isBullet && cleanLine.length < 80 && /^[A-Z]/.test(cleanLine) && !hasDate) {
          // Could be company or location line
          var locM = cleanLine.match(/,\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)*|[A-Z]{2})$/);
          if (locM) {
            current.company = cleanLine.replace(locM[0], '').trim();
            current.location = locM[1].trim();
          } else {
            current.company = cleanLine;
          }
        } else if (!current.title && hasTitle && !isBullet) {
          current.title = cleanLine.replace(/[,|]+$/, '').trim();
        } else if (hasDate && !current.startDate) {
          var dm = cleanLine.match(datePattern);
          if (dm) {
            var dp = dm[0].split(/\s*[\-–]\s*|\s*to\s*/i);
            current.startDate = (dp[0] || '').trim();
            current.endDate = (dp[1] || '').trim();
          }
        } else {
          // Description / bullet point
          var bullet = cleanLine.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '');
          if (bullet.length > 5) {
            current.description = current.description ? current.description + '\n' + bullet : bullet;
          }
        }
      }
    }
    if (current && (current.title || current.company)) entries.push(current);
    return entries;
  }

  // Parse projects section
  _parseProjects(lines) {
    var entries = [];
    var current = null;
    var techPattern = /(?:technolog|tech stack|built with|tools?|stack|using)[:\s]*(.+)/i;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cleanLine = line.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim();
      if (!cleanLine) continue;

      var isBullet = /^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]/.test(line.trim());
      var hasTech = techPattern.test(cleanLine);

      // Project name: non-bullet line, starts with capital, relatively short
      if (!isBullet && /^[A-Z]/.test(cleanLine) && cleanLine.length < 100 && !hasTech) {
        if (current) entries.push(current);
        current = { name: '', technologies: '', description: '', url: '' };

        // Check for "Project Name | Tech1, Tech2" or "Project Name (Tech1, Tech2)"
        var nameWithTech = cleanLine.match(/^(.+?)(?:\s*[\|–\-]\s*|\s*\()(.*?)(?:\))?$/);
        if (nameWithTech && nameWithTech[2].length > 2) {
          current.name = nameWithTech[1].trim();
          current.technologies = nameWithTech[2].trim();
        } else {
          current.name = cleanLine;
        }
        // Extract URL
        var urlM = cleanLine.match(/https?:\/\/\S+/);
        if (urlM) {
          current.url = urlM[0];
          current.name = current.name.replace(urlM[0], '').trim();
        }
      } else if (current) {
        if (hasTech && !current.technologies) {
          var tm = cleanLine.match(techPattern);
          if (tm) current.technologies = tm[1].trim();
        } else {
          var urlMatch = cleanLine.match(/https?:\/\/\S+|github\.com\/\S+/i);
          if (urlMatch && !current.url) {
            current.url = urlMatch[0];
          }
          var desc = cleanLine.replace(/https?:\/\/\S+/g, '').trim();
          if (desc.length > 5) {
            current.description = current.description ? current.description + '\n' + desc : desc;
          }
        }
      }
    }
    if (current && current.name) entries.push(current);
    return entries;
  }

  // Parse skills section
  _parseSkills(lines) {
    var skills = { technical: '', soft: '', tools: '', languages: '' };
    var allSkills = [];
    var softKeywords = /\b(communication|leadership|teamwork|team work|problem.?solving|critical thinking|time management|adaptability|creativity|collaboration|interpersonal|presentation|management|negotiation|analytical|decision.?making|organization|empathy|flexibility|motivation|conflict resolution|emotional intelligence)\b/i;
    var toolKeywords = /\b(git|docker|kubernetes|jenkins|aws|azure|gcp|jira|trello|figma|sketch|photoshop|vs code|visual studio|intellij|eclipse|postman|slack|notion|confluence|terraform|ansible|ci\/cd|linux|windows|macos|npm|yarn|webpack|vite|nginx|apache)\b/i;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var cleanLine = line.replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim();
      if (!cleanLine) continue;

      // Check for labeled lines: "Technical Skills: React, Node.js"
      var labeled = cleanLine.match(/^(technical|programming|soft|tools?|frameworks?|languages?|databases?|technologies|software|platforms?|cloud|devops|frontend|backend|web)[:\s]+(.+)$/i);
      if (labeled) {
        var category = labeled[1].toLowerCase();
        var vals = labeled[2].trim();
        if (/soft/i.test(category)) {
          skills.soft = skills.soft ? skills.soft + ', ' + vals : vals;
        } else if (/tool|software|platform|devops|cloud/i.test(category)) {
          skills.tools = skills.tools ? skills.tools + ', ' + vals : vals;
        } else if (/language/i.test(category) && /\b(java|python|c\+\+|javascript|typescript|ruby|go|rust|swift|kotlin|php|perl|scala|r|sql|html|css)\b/i.test(vals)) {
          skills.technical = skills.technical ? skills.technical + ', ' + vals : vals;
        } else {
          skills.technical = skills.technical ? skills.technical + ', ' + vals : vals;
        }
      } else {
        // Unlabeled: split by commas/pipes and categorize
        var items = cleanLine.split(/[,|;•\u2022]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 1; });
        items.forEach(function(item) {
          allSkills.push(item);
        });
      }
    }

    // Categorize uncategorized skills
    if (allSkills.length > 0) {
      var softList = [];
      var toolList = [];
      var techList = [];
      allSkills.forEach(function(s) {
        if (softKeywords.test(s)) softList.push(s);
        else if (toolKeywords.test(s)) toolList.push(s);
        else techList.push(s);
      });
      if (techList.length > 0) skills.technical = skills.technical ? skills.technical + ', ' + techList.join(', ') : techList.join(', ');
      if (softList.length > 0) skills.soft = skills.soft ? skills.soft + ', ' + softList.join(', ') : softList.join(', ');
      if (toolList.length > 0) skills.tools = skills.tools ? skills.tools + ', ' + toolList.join(', ') : toolList.join(', ');
    }

    return skills;
  }

  // Parse certifications section
  _parseCertifications(lines) {
    var certs = [];
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim();
      if (line.length < 3) continue;
      var cert = { name: line, organization: '', date: '' };
      // Try to extract org: "Cert Name - Organization" or "Cert Name, Organization"
      var parts = line.match(/^(.+?)(?:\s*[\-–|,]\s*)(.+?)(?:\s*[\-–|,]\s*(\d{4}|\w+\s*\d{4}))?$/);
      if (parts) {
        cert.name = parts[1].trim();
        cert.organization = parts[2].trim();
        if (parts[3]) cert.date = parts[3].trim();
      }
      // Extract date from anywhere in line
      var dateM = line.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\.?\s*\d{4}|\d{4})\b/i);
      if (dateM && !cert.date) cert.date = dateM[0];
      certs.push(cert);
    }
    return certs;
  }

  // Parse languages section
  _parseLanguages(lines) {
    var langs = [];
    var profLevels = /\b(native|fluent|proficient|intermediate|beginner|basic|advanced|elementary|conversational|professional|working proficiency|mother tongue|bilingual|a1|a2|b1|b2|c1|c2)\b/i;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].replace(/^[\u2022\u2023\u25E6\u2043\u2219•\-*◦‣⁃·]+\s*/, '').trim();
      if (line.length < 2) continue;
      // May be comma-separated on one line: "English (Fluent), Hindi (Native)"
      var items = line.split(/[,;]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 1; });
      items.forEach(function(item) {
        var prof = item.match(profLevels);
        var language = item.replace(profLevels, '').replace(/[\(\)\-–:]+/g, '').trim();
        if (language) {
          langs.push({ language: language, proficiency: prof ? prof[0] : '' });
        }
      });
    }
    return langs;
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

    // Two-column template
    if (template === 'two-column') return this._renderTwoColumn(resume, color, profile, education, experience, projects, skills, achievements, certifications, languages, interests, esc);
    // Bold template
    if (template === 'bold') return this._renderBold(resume, color, profile, education, experience, projects, skills, achievements, certifications, languages, interests, sectionOrder, esc);

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

  _renderTwoColumn(resume, color, profile, education, experience, projects, skills, achievements, certifications, languages, interests, esc) {
    const contactParts = [profile.phone, profile.email, profile.location, profile.linkedin, profile.github, profile.website || profile.portfolio].filter(Boolean);

    // Left sidebar: summary, contact, skills, tools, certifications, achievements, languages, interests
    let leftHTML = '';
    if (profile.summary) leftHTML += '<div class="sec"><div class="sh">Personal Profile</div><div class="sd">' + esc(profile.summary) + '</div></div>';
    if (contactParts.length) leftHTML += '<div class="sec"><div class="sh">Contact Details</div><div class="sd">' + contactParts.map(c => esc(c)).join('<br>') + '</div></div>';
    const skillItems = [];
    if (skills.technical) skills.technical.split(',').forEach(s => { if (s.trim()) skillItems.push(esc(s.trim())); });
    if (skills.soft) skills.soft.split(',').forEach(s => { if (s.trim()) skillItems.push(esc(s.trim())); });
    if (skillItems.length) leftHTML += '<div class="sec"><div class="sh">Skills & Abilities</div><ul>' + skillItems.map(s => '<li>' + s + '</li>').join('') + '</ul></div>';
    if (skills.tools) {
      const toolItems = skills.tools.split(',').map(s => s.trim()).filter(Boolean);
      if (toolItems.length) leftHTML += '<div class="sec"><div class="sh">Software / Tools</div><ul>' + toolItems.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul></div>';
    }
    if (certifications.length) leftHTML += '<div class="sec"><div class="sh">Certifications</div><ul>' + certifications.map(c => '<li>' + esc(c.name || c.cert_name || '') + '</li>').join('') + '</ul></div>';
    if (achievements.length) leftHTML += '<div class="sec"><div class="sh">Achievements</div><ul>' + achievements.map(a => '<li>' + esc(typeof a === 'string' ? a : (a.achievement_text || '')) + '</li>').join('') + '</ul></div>';
    if (languages.length) leftHTML += '<div class="sec"><div class="sh">Languages</div><ul>' + languages.map(l => '<li>' + esc(l.language || l.name || '') + ' (' + esc(l.proficiency || l.level || '') + ')</li>').join('') + '</ul></div>';
    if (interests.length) leftHTML += '<div class="sec"><div class="sh">Interests</div><div class="sd">' + interests.map(i => esc(typeof i === 'string' ? i : (i.name || ''))).join(', ') + '</div></div>';

    // Right main: experience, education, projects
    let rightHTML = '';
    if (experience.length) {
      rightHTML += '<div class="sec"><div class="sh">Experience</div>' + experience.map(e => {
        return '<div class="entry"><div class="et">' + esc(e.title || e.role || '') + '</div>' +
          '<div class="em">' + esc(e.company || '') + ' | ' + esc(e.startDate || e.start_date || '') + ' - ' + esc(e.endDate || e.end_date || 'Present') + '</div>' +
          '<div class="ed">' + esc(e.description || '') + '</div></div>';
      }).join('') + '</div>';
    }
    if (education.length) {
      rightHTML += '<div class="sec"><div class="sh">Academic Profile</div>' + education.map(e => {
        const yr = e.year || (e.start_year && e.end_year ? e.start_year + ' - ' + e.end_year : '');
        return '<div class="entry"><div class="et">' + esc(e.institution || '') + '</div>' +
          '<div class="em">' + esc(e.degree || '') + (e.field ? ' in ' + esc(e.field) : '') + (yr ? ' | ' + esc(yr) : '') + (e.gpa || e.cgpa ? ' | GPA: ' + esc(e.gpa || e.cgpa) : '') + '</div></div>';
      }).join('') + '</div>';
    }
    if (projects.length) {
      rightHTML += '<div class="sec"><div class="sh">Projects</div>' + projects.map(p => {
        return '<div class="entry"><div class="et">' + esc(p.name || p.project_name || '') + (p.technologies ? ' (' + esc(p.technologies) + ')' : '') + '</div>' +
          '<div class="ed">' + esc(p.description || '') + '</div></div>';
      }).join('') + '</div>';
    }

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:"Calibri","Segoe UI",sans-serif;color:#333;line-height:1.5;font-size:12px}' +
      '.header{background:' + color + ';color:white;padding:28px 32px;text-align:center}' +
      '.header h1{font-size:30px;font-weight:700;letter-spacing:1px;color:white;margin:0}' +
      '.header .hl{font-size:14px;opacity:0.85;margin-top:4px}' +
      '.main{display:flex;min-height:900px}' +
      '.sidebar{width:38%;background:#f8f9fa;padding:18px 20px;border-right:1px solid #e5e7eb}' +
      '.content{width:62%;padding:18px 22px}' +
      '.sh{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:' + color + ';border-bottom:2px solid ' + color + ';padding-bottom:3px;margin-bottom:8px}' +
      '.sec{margin-bottom:16px}' +
      '.sd{font-size:11.5px;color:#555}' +
      '.entry{margin-bottom:10px}' +
      '.et{font-weight:600;font-size:13px}' +
      '.em{font-size:10.5px;color:#666;font-style:italic;margin-bottom:2px}' +
      '.ed{font-size:11.5px;color:#444;white-space:pre-line;margin-top:2px}' +
      'ul{padding-left:16px;font-size:11.5px}li{margin-bottom:3px}' +
      '@media print{.main{min-height:auto}}' +
      '</style></head><body>' +
      '<div class="header"><h1>' + esc(profile.name || profile.full_name || 'Your Name') + '</h1>' +
      (profile.headline ? '<div class="hl">' + esc(profile.headline) + '</div>' : '') +
      '</div>' +
      '<div class="main">' +
      '<div class="sidebar">' + leftHTML + '</div>' +
      '<div class="content">' + rightHTML + '</div>' +
      '</div></body></html>';
  }

  _renderBold(resume, color, profile, education, experience, projects, skills, achievements, certifications, languages, interests, sectionOrder, esc) {
    const contactParts = [profile.email, profile.phone, profile.location, profile.linkedin, profile.website || profile.portfolio || profile.github].filter(Boolean);

    function h2(title) { return '<h2>' + title + '</h2>'; }

    const renderSection = (key) => {
      switch (key) {
        case 'profile': return '';
        case 'education':
          if (!education.length) return '';
          return h2('EDUCATION') + education.map(function(e) {
            var yr = e.year || (e.start_year && e.end_year ? e.start_year + ' - ' + e.end_year : '');
            return '<div class="entry"><div class="entry-header"><span>' + esc(e.institution) + '</span><span>' + esc(yr) + '</span></div><div class="entry-sub">' + esc(e.degree) + (e.field ? ' in ' + esc(e.field) : '') + (e.gpa || e.cgpa ? ' | GPA: ' + esc(e.gpa || e.cgpa) : '') + '</div></div>';
          }).join('');
        case 'experience':
          if (!experience.length) return '';
          return h2('EXPERIENCE') + experience.map(function(e) {
            return '<div class="entry"><div class="entry-header"><span>' + esc(e.title || e.role) + ' — ' + esc(e.company) + '</span><span>' + esc(e.startDate || e.start_date || '') + ' - ' + esc(e.endDate || e.end_date || 'Present') + '</span></div><div class="entry-desc">' + esc(e.description) + '</div></div>';
          }).join('');
        case 'projects':
          if (!projects.length) return '';
          return h2('PROJECTS') + projects.map(function(p) {
            return '<div class="entry"><div class="entry-header"><span>' + esc(p.name || p.project_name) + '</span><span>' + esc(p.technologies) + '</span></div><div class="entry-desc">' + esc(p.description) + '</div></div>';
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
            return '<li>' + esc(typeof a === 'string' ? a : (a.achievement_text || '')) + '</li>';
          }).join('') + '</ul>';
        case 'certifications':
          if (!certifications.length) return '';
          return h2('CERTIFICATIONS') + '<ul>' + certifications.map(function(c) {
            return '<li><strong>' + esc(c.name || c.cert_name) + '</strong>' + (c.organization ? ' — ' + esc(c.organization) : '') + '</li>';
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

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
      '*{margin:0;padding:0;box-sizing:border-box}' +
      'body{font-family:"Calibri","Segoe UI",sans-serif;color:#333;line-height:1.5;font-size:13px}' +
      '.hdr{background:' + color + ';color:white;padding:28px 36px}' +
      '.hdr h1{font-size:28px;font-weight:700;letter-spacing:1px;color:white;margin:0}' +
      '.hdr .hl{font-size:14px;opacity:0.9;margin-top:3px}' +
      '.hdr .ct{font-size:11px;opacity:0.75;margin-top:6px}' +
      '.body-content{padding:24px 36px}' +
      '.summary{font-size:12px;color:#444;margin-bottom:14px}' +
      'h2{font-size:12px;text-transform:uppercase;letter-spacing:1.5px;border-bottom:2px solid ' + color + ';padding-bottom:3px;margin:14px 0 8px;color:' + color + ';font-weight:700}' +
      '.entry{margin-bottom:10px}.entry-header{display:flex;justify-content:space-between;font-weight:600;font-size:13px}' +
      '.entry-sub{font-style:italic;font-size:11px;color:#555}.entry-desc{font-size:12px;margin-top:2px;white-space:pre-line}' +
      '.skills-grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:12px}.skill-cat{font-weight:600}' +
      'ul{padding-left:18px;font-size:12px}li{margin-bottom:3px}p{font-size:12px}' +
      '@media print{.body-content{padding:15px 20px}}' +
      '</style></head><body>' +
      '<div class="hdr"><h1>' + esc(profile.name || profile.full_name || 'Your Name') + '</h1>' +
      (profile.headline ? '<div class="hl">' + esc(profile.headline) + '</div>' : '') +
      '<div class="ct">' + contactParts.join(' | ') + '</div></div>' +
      '<div class="body-content">' +
      (profile.summary ? '<div class="summary">' + esc(profile.summary) + '</div>' : '') +
      sectionsHTML +
      '</div></body></html>';
  }
}

module.exports = new ResumeService();
