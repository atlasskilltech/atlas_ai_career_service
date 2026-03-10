const atsService = require('../services/atsService');

class AtsController {
  async index(req, res) {
    try {
      const history = await atsService.getHistory(req.session.user.id);
      res.render('pages/resume/ats', { title: 'ATS Analyzer', layout: 'layouts/app', history, analysis: null });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async analyze(req, res) {
    try {
      const { resumeText, jobDescription, resumeId } = req.body;
      const analysis = await atsService.analyzeResume(req.session.user.id, resumeText, jobDescription, resumeId);
      res.json({ success: true, analysis });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new AtsController();
