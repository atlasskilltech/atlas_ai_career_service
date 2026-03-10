const coverLetterService = require('../services/coverLetterService');

class CoverLetterController {
  async index(req, res) {
    try {
      const letters = await coverLetterService.getAll(req.session.user.id);
      res.render('pages/cover-letter/index', { title: 'Cover Letters', layout: 'layouts/app', letters });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  getNew(req, res) {
    res.render('pages/cover-letter/generate', { title: 'Generate Cover Letter', layout: 'layouts/app' });
  }

  async generate(req, res) {
    try {
      const letter = await coverLetterService.generate(req.session.user.id, req.body);
      res.json({ success: true, letter });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async view(req, res) {
    try {
      const letter = await coverLetterService.getById(req.params.id);
      res.render('pages/cover-letter/view', { title: 'Cover Letter', layout: 'layouts/app', letter });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/cover-letter');
    }
  }

  async update(req, res) {
    try {
      await coverLetterService.update(req.params.id, { content: req.body.content });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await coverLetterService.delete(req.params.id);
      req.flash('success', 'Cover letter deleted');
      res.redirect('/cover-letter');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/cover-letter');
    }
  }
}

module.exports = new CoverLetterController();
