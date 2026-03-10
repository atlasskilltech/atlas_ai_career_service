const skillService = require('../services/skillService');

class SkillController {
  async index(req, res) {
    try {
      const analyses = await skillService.getAll(req.session.user.id);
      res.render('pages/skills/index', { title: 'Skill Gap Analyzer', layout: 'layouts/app', analyses });
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
