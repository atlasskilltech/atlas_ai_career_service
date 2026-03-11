const coverLetterService = require('../services/coverLetterService');
const resumeService = require('../services/resumeService');

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

  async getNew(req, res) {
    try {
      const resumes = await resumeService.getAll(req.session.user.id);
      res.render('pages/cover-letter/generate', {
        title: 'Generate Cover Letter',
        layout: 'layouts/app',
        resumes,
      });
    } catch (err) {
      res.render('pages/cover-letter/generate', {
        title: 'Generate Cover Letter',
        layout: 'layouts/app',
        resumes: [],
      });
    }
  }

  async generate(req, res) {
    try {
      const { companyName, jobTitle, jobDescription, resumeText, resumeId, tone } = req.body;
      if (!companyName || !jobTitle) {
        return res.status(400).json({ error: 'Company name and job title are required' });
      }
      const letter = await coverLetterService.generate(req.session.user.id, {
        companyName,
        jobTitle,
        jobDescription,
        resumeText,
        resumeId,
        tone: tone || 'professional',
      });
      res.json({ success: true, letter });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async view(req, res) {
    try {
      const letter = await coverLetterService.getById(req.params.id);
      if (!letter) {
        req.flash('error', 'Cover letter not found');
        return res.redirect('/cover-letter');
      }
      const versions = await coverLetterService.getVersions(req.params.id);
      const resumes = await resumeService.getAll(req.session.user.id);
      res.render('pages/cover-letter/view', {
        title: 'Cover Letter',
        layout: 'layouts/app',
        letter,
        versions,
        resumes,
      });
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

  // Save version snapshot
  async saveVersion(req, res) {
    try {
      const version = await coverLetterService.saveVersion(req.params.id);
      res.json({ success: true, version });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // Get version history
  async getVersions(req, res) {
    try {
      const versions = await coverLetterService.getVersions(req.params.id);
      res.json({ success: true, versions });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // Restore a version
  async restoreVersion(req, res) {
    try {
      const result = await coverLetterService.restoreVersion(
        req.params.id,
        parseInt(req.params.versionId)
      );
      res.json({ success: true, content: result.content });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  // Export as PDF
  async exportPDF(req, res) {
    try {
      const template = req.body.template || 'professional';
      const pdfBuffer = await coverLetterService.exportPDF(req.params.id, template);
      const letter = await coverLetterService.getById(req.params.id);
      const filename = `cover-letter-${(letter.company_name || 'untitled').replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length,
      });
      res.send(pdfBuffer);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // Regenerate with different tone/data
  async regenerate(req, res) {
    try {
      const result = await coverLetterService.regenerate(
        req.params.id,
        req.session.user.id,
        req.body
      );
      res.json({ success: true, letter: result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new CoverLetterController();
