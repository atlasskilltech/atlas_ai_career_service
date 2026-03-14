const service = require('../services/jobMgmtService');

class JobMgmtController {
  // ─── Pages ──────────────────────────────────────────────

  async index(req, res) {
    try {
      const result = await service.getJobs(req.query);
      const filterOptions = await service.getFilterOptions();
      const stats = await service.getStats();
      res.render('pages/admin/jobs/index', {
        title: 'Jobs Management',
        layout: 'layouts/admin',
        jobs: result.jobs,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
        query: req.query,
        filterOptions,
        stats,
      });
    } catch (err) {
      console.error('JobMgmt index error:', err);
      req.flash('error', 'Failed to load jobs');
      res.redirect('/admin');
    }
  }

  async createPage(req, res) {
    try {
      res.render('pages/admin/jobs/create', {
        title: 'Create Job',
        layout: 'layouts/admin',
        job: null,
        query: req.query,
      });
    } catch (err) {
      req.flash('error', 'Failed to load form');
      res.redirect('/admin/jobs');
    }
  }

  async editPage(req, res) {
    try {
      const job = await service.getJobById(req.params.id);
      res.render('pages/admin/jobs/create', {
        title: 'Edit Job',
        layout: 'layouts/admin',
        job,
        query: req.query,
      });
    } catch (err) {
      req.flash('error', err.message || 'Job not found');
      res.redirect('/admin/jobs');
    }
  }

  async detailPage(req, res) {
    try {
      const job = await service.getJobById(req.params.id);
      const applicants = await service.getApplicants(req.params.id, req.query);
      res.render('pages/admin/jobs/detail', {
        title: `${job.role_title} - ${job.company_name}`,
        layout: 'layouts/admin',
        job,
        applicants,
        query: req.query,
      });
    } catch (err) {
      req.flash('error', err.message || 'Job not found');
      res.redirect('/admin/jobs');
    }
  }

  // ─── API ────────────────────────────────────────────────

  _parseBody(req) {
    const body = req.body;
    // If a file was uploaded, use its path as the logo
    if (req.file) {
      body.company_logo = '/uploads/logos/' + req.file.filename;
    }
    // Parse arrays from form
    if (typeof body.eligible_programs === 'string') body.eligible_programs = body.eligible_programs.split(',').map(s => s.trim()).filter(Boolean);
    if (typeof body.eligible_branches === 'string') body.eligible_branches = body.eligible_branches.split(',').map(s => s.trim()).filter(Boolean);
    if (typeof body.eligible_years === 'string') body.eligible_years = body.eligible_years.split(',').map(s => s.trim()).filter(Boolean);
    if (typeof body.skills === 'string') body.skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (typeof body.rounds === 'string') body.rounds = JSON.parse(body.rounds);
    return body;
  }

  async apiCreate(req, res) {
    try {
      const body = this._parseBody(req);
      const jobId = await service.createJob(body, req.session.user.id);
      res.json({ success: true, jobId, message: 'Job created successfully' });
    } catch (err) {
      console.error('Job create error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiUpdate(req, res) {
    try {
      const body = this._parseBody(req);
      await service.updateJob(req.params.id, body);
      res.json({ success: true, message: 'Job updated successfully' });
    } catch (err) {
      console.error('Job update error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiUpdateStatus(req, res) {
    try {
      await service.updateStatus(req.params.id, req.body.status);
      res.json({ success: true, message: 'Status updated' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiDelete(req, res) {
    try {
      await service.deleteJob(req.params.id);
      res.json({ success: true, message: 'Job deleted' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiGetJob(req, res) {
    try {
      const job = await service.getJobById(req.params.id);
      res.json({ success: true, job });
    } catch (err) {
      res.status(404).json({ success: false, error: err.message });
    }
  }

  async apiGetApplicants(req, res) {
    try {
      const applicants = await service.getApplicants(req.params.id, req.query);
      const pipeline = await service.getPipeline(req.params.id);
      res.json({ success: true, applicants, pipeline });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiMoveApplicant(req, res) {
    try {
      await service.moveApplicant(req.params.appId, req.body.stage, req.body.notes);
      res.json({ success: true, message: 'Applicant updated' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiAddNote(req, res) {
    try {
      await service.addNote(req.params.appId, req.body.note);
      res.json({ success: true, message: 'Note saved' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiBulkShortlist(req, res) {
    try {
      await service.bulkShortlist(req.body.application_ids || []);
      res.json({ success: true, message: 'Students shortlisted' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async exportExcel(req, res) {
    try {
      const wb = await service.exportJobs(req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=jobs_export.xlsx');
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Export error:', err);
      req.flash('error', 'Export failed');
      res.redirect('/admin/jobs');
    }
  }
}

module.exports = new JobMgmtController();
