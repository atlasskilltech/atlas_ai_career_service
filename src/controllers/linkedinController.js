const linkedinService = require('../services/linkedinService');

class LinkedinController {
  async index(req, res) {
    try {
      const analyses = await linkedinService.getAll(req.session.user.id);
      const latest = analyses[0] || null;
      res.render('pages/linkedin/index', { title: 'LinkedIn Optimizer', layout: 'layouts/app', analyses, latest });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async optimize(req, res) {
    try {
      const result = await linkedinService.optimize(req.session.user.id, req.body);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new LinkedinController();
