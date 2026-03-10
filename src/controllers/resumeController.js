const resumeService = require('../services/resumeService');

class ResumeController {
  async index(req, res) {
    try {
      const resumes = await resumeService.getAll(req.session.user.id);
      res.render('pages/resume/index', { title: 'My Resumes', layout: 'layouts/app', resumes });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async create(req, res) {
    res.render('pages/resume/builder', {
      title: 'New Resume',
      layout: 'layouts/app',
      resume: null,
    });
  }

  async store(req, res) {
    try {
      const resume = await resumeService.create(req.session.user.id, req.body);
      req.flash('success', 'Resume created successfully');
      res.redirect(`/resume/${resume.id}/edit`);
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/resume/new');
    }
  }

  async edit(req, res) {
    try {
      const resume = await resumeService.getById(req.params.id);
      res.render('pages/resume/builder', { title: 'Edit Resume', layout: 'layouts/app', resume });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/resume');
    }
  }

  async update(req, res) {
    try {
      await resumeService.update(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await resumeService.delete(req.params.id);
      req.flash('success', 'Resume deleted');
      res.redirect('/resume');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/resume');
    }
  }

  async setPrimary(req, res) {
    try {
      await resumeService.setPrimary(req.session.user.id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async generateBullets(req, res) {
    try {
      const bullets = await resumeService.generateBulletPoints(req.body);
      res.json({ success: true, bullets });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async generateSummary(req, res) {
    try {
      const summary = await resumeService.generateSummary(req.body);
      res.json({ success: true, summary });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async rewriteAchievement(req, res) {
    try {
      const rewritten = await resumeService.rewriteAchievement(req.body.achievement);
      res.json({ success: true, rewritten });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async preview(req, res) {
    try {
      const resume = await resumeService.getById(req.params.id);
      res.render('pages/resume/preview', { title: 'Resume Preview', layout: false, resume });
    } catch (err) {
      res.status(404).send('Resume not found');
    }
  }
}

module.exports = new ResumeController();
