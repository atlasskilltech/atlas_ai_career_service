const service = require('../services/skillGapAnalysisService');

class SkillGapController {
  // ─── Pages ──────────────────────────────────────────────

  async dashboard(req, res) {
    try {
      const filters = {
        department: req.query.department || null,
        program: req.query.program || null,
        graduation_year: req.query.graduation_year || null
      };
      const [dashData, trends] = await Promise.all([
        service.getDashboardData(filters),
        service.getTrends()
      ]);
      res.render('pages/admin/skills/gap-dashboard', {
        title: 'Skill Gap Analysis',
        layout: 'layouts/admin',
        ...dashData,
        trends,
        query: req.query
      });
    } catch (err) {
      console.error('Skill gap dashboard error:', err);
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async heatmapPage(req, res) {
    try {
      const heatmap = await service.getHeatmapData();
      res.render('pages/admin/skills/heatmap', {
        title: 'Skills Heatmap',
        layout: 'layouts/admin',
        heatmap
      });
    } catch (err) {
      console.error('Heatmap error:', err);
      req.flash('error', err.message);
      res.redirect('/admin/skill-gap');
    }
  }

  async insightsPage(req, res) {
    try {
      const insights = await service.getAIInsights(false);
      const filterOptions = await service.getFilterOptions();
      res.render('pages/admin/skills/insights', {
        title: 'AI Skill Insights',
        layout: 'layouts/admin',
        insights,
        filterOptions
      });
    } catch (err) {
      console.error('Insights error:', err);
      req.flash('error', err.message);
      res.redirect('/admin/skill-gap');
    }
  }

  // ─── API ────────────────────────────────────────────────

  async apiDemand(req, res) {
    try {
      const data = await service.getDashboardData(req.query);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiGap(req, res) {
    try {
      const gaps = await service.getDashboardData(req.query);
      res.json({ success: true, topGaps: gaps.topGaps, summary: gaps.summary });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiHeatmap(req, res) {
    try {
      const heatmap = await service.getHeatmapData();
      res.json({ success: true, heatmap });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiTrends(req, res) {
    try {
      const trends = await service.getTrends();
      res.json({ success: true, trends });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiRecompute(req, res) {
    try {
      await service.recompute(req.body);
      res.json({ success: true, message: 'Skill gap data recomputed' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiInsights(req, res) {
    try {
      const forceRefresh = req.query.refresh === 'true';
      const insights = await service.getAIInsights(forceRefresh);
      res.json({ success: true, insights });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async exportExcel(req, res) {
    try {
      const wb = await service.exportGapReport(req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=skill_gap_report.xlsx');
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Export error:', err);
      req.flash('error', 'Export failed');
      res.redirect('/admin/skill-gap');
    }
  }
}

module.exports = new SkillGapController();
