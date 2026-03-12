const skillService = require('../services/skillService');
const resumeRepository = require('../repositories/resumeRepository');

class SkillController {
  async index(req, res) {
    try {
      const [analyses, resumes] = await Promise.all([
        skillService.getAll(req.session.user.id),
        resumeRepository.findByUserId(req.session.user.id),
      ]);
      res.render('pages/skills/index', { title: 'Skill Gap Analyzer', layout: 'layouts/app', analyses, resumes });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async analyze(req, res) {
    try {
      const result = await skillService.analyze(req.session.user.id, req.body);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new SkillController();
