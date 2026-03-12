const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const { isAuthenticated } = require('../middleware/auth');
const { resumeMemoryUpload } = require('../config/multer');
const resumeService = require('../services/resumeService');

router.use(isAuthenticated);

router.get('/', skillController.index);
router.post('/analyze', skillController.analyze);

// Upload resume file and extract text for skill analysis
router.post('/upload-parse', resumeMemoryUpload.single('resume'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const ext = require('path').extname(req.file.originalname).toLowerCase();
    const extractResult = await resumeService.extractTextFromResume(req.file.buffer, ext);
    return res.json({ success: true, text: extractResult.text });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to parse resume' });
  }
});

// Get text representation of a saved resume for skill analysis
router.get('/resume-text/:id', async (req, res) => {
  try {
    const resumeRepository = require('../repositories/resumeRepository');
    const resume = await resumeRepository.findById(req.params.id);
    if (!resume || resume.user_id !== req.session.user.id) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    // Build a text representation from resume JSON data
    const parts = [];
    const parse = (val) => typeof val === 'string' ? JSON.parse(val) : (val || {});

    const profile = parse(resume.profile_data);
    if (profile.name) parts.push(profile.name);
    if (profile.title) parts.push(profile.title);
    if (profile.summary) parts.push(profile.summary);

    const skills = parse(resume.skills_data);
    if (skills.technical) parts.push('Technical Skills: ' + (Array.isArray(skills.technical) ? skills.technical.join(', ') : skills.technical));
    if (skills.soft) parts.push('Soft Skills: ' + (Array.isArray(skills.soft) ? skills.soft.join(', ') : skills.soft));
    if (skills.languages) parts.push('Languages: ' + (Array.isArray(skills.languages) ? skills.languages.join(', ') : skills.languages));
    if (skills.tools) parts.push('Tools: ' + (Array.isArray(skills.tools) ? skills.tools.join(', ') : skills.tools));

    const experience = parse(resume.experience_data);
    if (Array.isArray(experience)) {
      experience.forEach(exp => {
        const line = [exp.title, exp.company, exp.duration].filter(Boolean).join(' - ');
        if (line) parts.push(line);
        if (exp.description) parts.push(exp.description);
        if (Array.isArray(exp.highlights)) parts.push(exp.highlights.join('. '));
      });
    }

    const education = parse(resume.education_data);
    if (Array.isArray(education)) {
      education.forEach(edu => {
        const line = [edu.degree, edu.institution, edu.year].filter(Boolean).join(' - ');
        if (line) parts.push(line);
      });
    }

    const projects = parse(resume.projects_data);
    if (Array.isArray(projects)) {
      projects.forEach(proj => {
        if (proj.name) parts.push(proj.name);
        if (proj.description) parts.push(proj.description);
        if (proj.technologies) parts.push('Technologies: ' + (Array.isArray(proj.technologies) ? proj.technologies.join(', ') : proj.technologies));
      });
    }

    const certifications = parse(resume.certifications_data);
    if (Array.isArray(certifications)) {
      certifications.forEach(cert => {
        const line = [cert.name, cert.issuer, cert.year].filter(Boolean).join(' - ');
        if (line) parts.push(line);
      });
    }

    return res.json({ success: true, text: parts.join('\n') });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to load resume' });
  }
});

module.exports = router;
