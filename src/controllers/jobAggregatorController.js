const jobAggregatorService = require('../services/jobAggregatorService');

class JobAggregatorController {
  // ─── Pages ─────────────────────────────────────────────────

  async index(req, res) {
    try {
      const filters = {
        query: req.query.q || '',
        location: req.query.location || '',
        category: req.query.category || '',
        jobType: req.query.jobType || '',
        workMode: req.query.workMode || '',
        experience: req.query.experience || '',
        salaryMin: req.query.salaryMin || '',
        source: req.query.source || '',
        page: parseInt(req.query.page) || 1,
        limit: 20,
      };
      const result = await jobAggregatorService.searchJobs(filters);
      const categories = await jobAggregatorService.getCategories();
      const locations = await jobAggregatorService.getLocations();
      const stats = await jobAggregatorService.getStats();

      res.render('pages/job-board/index', {
        title: 'Job Board',
        layout: 'layouts/app',
        jobs: result.jobs,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        filters,
        categories,
        locations,
        stats,
      });
    } catch (err) {
      req.flash('error', 'Failed to load job board');
      res.redirect('/dashboard');
    }
  }

  async viewJob(req, res) {
    try {
      const job = await jobAggregatorService.getJobById(req.params.id, req.session.user.id);
      res.render('pages/job-board/view', {
        title: `${job.title} at ${job.company}`,
        layout: 'layouts/app',
        job,
      });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/job-board');
    }
  }

  async myApplications(req, res) {
    try {
      const applications = await jobAggregatorService.getMyApplications(req.session.user.id);
      res.render('pages/job-board/applications', {
        title: 'My Applications',
        layout: 'layouts/app',
        applications,
      });
    } catch (err) {
      req.flash('error', 'Failed to load applications');
      res.redirect('/job-board');
    }
  }

  async savedJobs(req, res) {
    try {
      const jobs = await jobAggregatorService.getSavedJobs(req.session.user.id);
      res.render('pages/job-board/saved', {
        title: 'Saved Jobs',
        layout: 'layouts/app',
        jobs,
      });
    } catch (err) {
      req.flash('error', 'Failed to load saved jobs');
      res.redirect('/job-board');
    }
  }

  // ─── API Endpoints ─────────────────────────────────────────

  async apiSearch(req, res) {
    try {
      const result = await jobAggregatorService.searchJobs(req.query);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async apiApply(req, res) {
    try {
      const result = await jobAggregatorService.applyToJob(
        req.session.user.id, req.params.id, req.body.resumeId, req.body.coverLetter
      );
      res.json({ success: true, application: result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async apiSaveJob(req, res) {
    try {
      await jobAggregatorService.saveJob(req.session.user.id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async apiUnsaveJob(req, res) {
    try {
      await jobAggregatorService.unsaveJob(req.session.user.id, req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async apiMatchJob(req, res) {
    try {
      const result = await jobAggregatorService.matchJobToResume(req.body.resumeText, req.body.jobDescription);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  async adminIndex(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const source = req.query.source || '';
      const result = await jobAggregatorService.getAllJobs({ page, limit: 30, source });
      const stats = await jobAggregatorService.getStats();
      const scraperLogs = await jobAggregatorService.getScraperLogs();

      res.render('pages/job-board/admin', {
        title: 'Job Board Admin',
        layout: 'layouts/app',
        jobs: result.jobs,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
        stats,
        scraperLogs,
        source,
      });
    } catch (err) {
      req.flash('error', 'Failed to load admin page');
      res.redirect('/job-board');
    }
  }

  async adminCreateJob(req, res) {
    try {
      const job = await jobAggregatorService.createJob({
        ...req.body,
        source: 'manual',
        isVerified: 1,
      });
      res.json({ success: true, job });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async adminUpdateJob(req, res) {
    try {
      await jobAggregatorService.updateJob(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async adminDeleteJob(req, res) {
    try {
      await jobAggregatorService.deleteJob(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async adminToggleActive(req, res) {
    try {
      await jobAggregatorService.updateJob(req.params.id, { isActive: req.body.isActive ? 1 : 0 });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async adminVerifyJob(req, res) {
    try {
      await jobAggregatorService.updateJob(req.params.id, { isVerified: 1 });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async adminBulkImport(req, res) {
    try {
      const { jobs, source } = req.body;
      if (!jobs || !Array.isArray(jobs)) return res.status(400).json({ error: 'jobs array required' });
      const result = await jobAggregatorService.bulkImportJobs(jobs, source || 'api');
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }

  async adminStats(req, res) {
    try {
      const stats = await jobAggregatorService.getStats();
      res.json({ success: true, stats });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new JobAggregatorController();
