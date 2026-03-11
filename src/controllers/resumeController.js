const resumeService = require('../services/resumeService');

class ResumeController {
  async index(req, res) {
    try {
      const resumes = await resumeService.getAll(req.session.user.id);
      res.render('pages/resume/index', { title: 'Resume Builder', layout: 'layouts/app', resumes });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async create(req, res) {
    res.render('pages/resume/builder', { title: 'New Resume', layout: 'layouts/app', resume: null });
  }

  async store(req, res) {
    try {
      const resume = await resumeService.create(req.session.user.id, req.body);
      res.json({ success: true, id: resume.id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async edit(req, res) {
    try {
      const resume = await resumeService.getById(req.params.id);
      const versions = await resumeService.getVersions(req.params.id);
      res.render('pages/resume/builder', { title: 'Edit Resume', layout: 'layouts/app', resume, versions });
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

  async duplicate(req, res) {
    try {
      const newResume = await resumeService.duplicate(req.params.id, req.session.user.id);
      res.json({ success: true, id: newResume.id });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async preview(req, res) {
    try {
      const resume = await resumeService.getById(req.params.id);
      const html = resumeService.renderTemplate(resume);
      res.send(html);
    } catch (err) {
      res.status(404).send('Resume not found');
    }
  }

  async previewTemplate(req, res) {
    try {
      const resume = await resumeService.getById(req.params.id);
      resume.template = req.query.template || resume.template;
      resume.theme_color = req.query.color || resume.theme_color;
      const html = resumeService.renderTemplate(resume);
      res.send(html);
    } catch (err) {
      res.status(404).send('Resume not found');
    }
  }

  // PDF Export
  async exportPDF(req, res) {
    try {
      const pdfBuffer = await resumeService.exportPDF(req.params.id);
      const resume = await resumeService.getById(req.params.id);
      const filename = (resume.title || 'resume').replace(/[^a-zA-Z0-9]/g, '_') + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Version History
  async saveVersion(req, res) {
    try {
      const version = await resumeService.saveVersion(req.params.id);
      res.json({ success: true, version });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async getVersions(req, res) {
    try {
      const versions = await resumeService.getVersions(req.params.id);
      res.json({ success: true, versions });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async restoreVersion(req, res) {
    try {
      const resume = await resumeService.restoreVersion(req.params.id, req.params.versionId);
      res.json({ success: true, resume });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // AI Tools
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

  async generateProjectDesc(req, res) {
    try {
      const description = await resumeService.generateProjectDescription(req.body);
      res.json({ success: true, description });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async suggestSkills(req, res) {
    try {
      const skills = await resumeService.suggestSkills(req.body);
      res.json({ success: true, skills });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async analyzeATS(req, res) {
    try {
      const resume = await resumeService.getById(req.body.resumeId || req.params.id);
      const analysis = await resumeService.analyzeATS(resume, req.body.jobDescription);
      res.json({ success: true, analysis });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Live preview data (AJAX)
  async getResumeData(req, res) {
    try {
      const resume = await resumeService.getById(req.params.id);
      res.json({ success: true, resume });
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  }
}

module.exports = new ResumeController();
