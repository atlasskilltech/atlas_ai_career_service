const jobService = require('../services/jobService');

class JobController {
  async index(req, res) {
    try {
      const jobs = await jobService.getAll(req.session.user.id);
      const stats = await jobService.getStats(req.session.user.id);
      const statusMap = {};
      stats.forEach(s => { statusMap[s.status] = s.count; });
      res.render('pages/jobs/tracker', { title: 'Job Tracker', layout: 'layouts/app', jobs, stats: statusMap });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/dashboard');
    }
  }

  async create(req, res) {
    try {
      const job = await jobService.create(req.session.user.id, req.body);
      res.json({ success: true, job });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async view(req, res) {
    try {
      const job = await jobService.getById(req.params.id);
      res.render('pages/jobs/view', { title: job.position, layout: 'layouts/app', job });
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/jobs');
    }
  }

  async update(req, res) {
    try {
      await jobService.update(req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async updateStatus(req, res) {
    try {
      await jobService.updateStatus(req.params.id, req.body.status);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async delete(req, res) {
    try {
      await jobService.delete(req.params.id);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async addTask(req, res) {
    try {
      const task = await jobService.addTask({ jobId: req.params.id, ...req.body });
      res.json({ success: true, task });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async toggleTask(req, res) {
    try {
      await jobService.toggleTask(req.params.taskId);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }

  async analyzeMatch(req, res) {
    try {
      const result = await jobService.analyzeMatch(req.body.resumeText, req.body.jobDescription);
      res.json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
}

module.exports = new JobController();
