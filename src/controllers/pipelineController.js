const service = require('../services/pipelineService');

class PipelineController {
  // ─── Pages ──────────────────────────────────────────────

  async selectJob(req, res) {
    try {
      const jobs = await service.getJobsWithApplicants();
      res.render('pages/admin/pipeline/select', {
        title: 'Application Pipeline',
        layout: 'layouts/admin',
        jobs,
        query: req.query,
      });
    } catch (err) {
      console.error('Pipeline selectJob error:', err);
      req.flash('error', 'Failed to load pipeline');
      res.redirect('/admin');
    }
  }

  async kanbanPage(req, res) {
    try {
      const data = await service.getPipelineData(req.params.jobId, req.query);
      res.render('pages/admin/pipeline/kanban', {
        title: `Pipeline - ${data.job.role_title}`,
        layout: 'layouts/admin',
        ...data,
        query: req.query,
      });
    } catch (err) {
      console.error('Pipeline kanban error:', err);
      req.flash('error', err.message || 'Failed to load pipeline');
      res.redirect('/admin/pipeline');
    }
  }

  async timelinePage(req, res) {
    try {
      const data = await service.getTimelineData(req.params.jobId);
      res.render('pages/admin/pipeline/timeline', {
        title: `Timeline - ${data.job.role_title}`,
        layout: 'layouts/admin',
        ...data,
        query: req.query,
      });
    } catch (err) {
      console.error('Pipeline timeline error:', err);
      req.flash('error', err.message || 'Failed to load timeline');
      res.redirect('/admin/pipeline');
    }
  }

  // ─── API ────────────────────────────────────────────────

  async apiGetPipeline(req, res) {
    try {
      const data = await service.getPipelineData(req.params.jobId, req.query);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiMoveCard(req, res) {
    try {
      const { stage, reason } = req.body;
      const result = await service.moveCard(
        req.params.appId,
        stage,
        req.session.user.id,
        reason
      );
      res.json({ success: true, message: 'Card moved successfully', ...result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiReorder(req, res) {
    try {
      const { stage, order } = req.body;
      await service.reorderCards(req.params.jobId, stage, order);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiUpdatePriority(req, res) {
    try {
      await service.updatePriority(req.params.appId, req.body.priority);
      res.json({ success: true, message: 'Priority updated' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiUpdateNotes(req, res) {
    try {
      await service.updateNotes(req.params.appId, req.body.notes);
      res.json({ success: true, message: 'Notes saved' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiGetHistory(req, res) {
    try {
      const history = await service.getHistory(req.params.appId);
      res.json({ success: true, history });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiGetAuditLog(req, res) {
    try {
      const log = await service.getJobAuditLog(req.params.jobId);
      res.json({ success: true, log });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}

module.exports = new PipelineController();
