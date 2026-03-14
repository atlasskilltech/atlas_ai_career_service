const service = require('../services/recruiterService');

class RecruiterMgmtController {
  // ─── Pages ──────────────────────────────────────────────────

  async index(req, res) {
    try {
      const [recruiters, filterOptions, listStats] = await Promise.all([
        service.listRecruiters(req.query),
        service.getFilterOptions(),
        service.getListStats()
      ]);
      res.render('pages/admin/recruiters/index', {
        title: 'Recruiter Management',
        layout: 'layouts/admin',
        recruiters,
        filterOptions,
        listStats,
        query: req.query
      });
    } catch (err) {
      console.error('Recruiter list error:', err);
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async profile(req, res) {
    try {
      const data = await service.getProfile(req.params.id);
      if (!data) {
        req.flash('error', 'Recruiter not found');
        return res.redirect('/admin/recruiters');
      }
      res.render('pages/admin/recruiters/profile', {
        title: `${data.recruiter.company_name} - Recruiter`,
        layout: 'layouts/admin',
        ...data
      });
    } catch (err) {
      console.error('Recruiter profile error:', err);
      req.flash('error', err.message);
      res.redirect('/admin/recruiters');
    }
  }

  // ─── API: CRUD ──────────────────────────────────────────────

  async apiCreate(req, res) {
    try {
      const body = req.body;
      body.created_by = req.session.user.id;
      const id = await service.createRecruiter(body);
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiUpdate(req, res) {
    try {
      await service.updateRecruiter(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiList(req, res) {
    try {
      const recruiters = await service.listRecruiters(req.query);
      res.json({ success: true, recruiters });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiGet(req, res) {
    try {
      const recruiter = await service.getRecruiter(req.params.id);
      if (!recruiter) return res.status(404).json({ success: false, error: 'Not found' });
      res.json({ success: true, recruiter });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── API: Stats / Jobs ─────────────────────────────────────

  async apiStats(req, res) {
    try {
      const stats = await service.getStats(req.params.id);
      if (!stats) return res.status(404).json({ success: false, error: 'Not found' });
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiJobs(req, res) {
    try {
      const jobs = await service.getJobs(req.params.id);
      res.json({ success: true, jobs });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // ─── API: Interactions ──────────────────────────────────────

  async apiAddInteraction(req, res) {
    try {
      const body = req.body;
      body.created_by = req.session.user.id;
      const id = await service.addInteraction(req.params.id, body);
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiMarkFollowUp(req, res) {
    try {
      await service.markFollowUpDone(req.params.interactionId);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiRecalcTiers(req, res) {
    try {
      await service.recalcAllTiers();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new RecruiterMgmtController();
