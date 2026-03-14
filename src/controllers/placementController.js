const service = require('../services/placementService');

class PlacementController {
  // ─── Pages ──────────────────────────────────────────────

  async analytics(req, res) {
    try {
      const filters = {
        academic_year: req.query.academic_year || null,
        program: req.query.program || null,
        branch: req.query.branch || null,
        industry: req.query.industry || null
      };
      const [dashData, trends] = await Promise.all([
        service.getDashboardData(filters),
        service.getTrends()
      ]);
      res.render('pages/admin/placement/analytics', {
        title: 'Placement Analytics',
        layout: 'layouts/admin',
        ...dashData,
        trends,
        query: req.query
      });
    } catch (err) {
      console.error('Placement analytics error:', err);
      req.flash('error', err.message);
      res.redirect('/admin');
    }
  }

  async reportsPage(req, res) {
    try {
      const filterOptions = await service.getFilterOptions();
      res.render('pages/admin/placement/reports', {
        title: 'Placement Reports',
        layout: 'layouts/admin',
        filterOptions,
        query: req.query
      });
    } catch (err) {
      console.error('Reports page error:', err);
      req.flash('error', err.message);
      res.redirect('/admin/placement');
    }
  }

  // ─── APIs ───────────────────────────────────────────────

  async apiSummary(req, res) {
    try {
      const data = await service.getDashboardData(req.query);
      res.json({ success: true, ...data });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiBreakdown(req, res) {
    try {
      const data = await service.getDashboardData(req.query);
      res.json({
        success: true,
        programBreakdown: data.programBreakdown,
        branchBreakdown: data.branchBreakdown,
        industryDist: data.industryDist,
        salaryDist: data.salaryDist,
        monthWise: data.monthWise
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  async apiCompanies(req, res) {
    try {
      const data = await service.getDashboardData(req.query);
      res.json({ success: true, topCompanies: data.topCompanies });
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

  // ─── Export ─────────────────────────────────────────────

  async exportExcel(req, res) {
    try {
      const wb = await service.exportExcel(req.query);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=placement_report.xlsx');
      await wb.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error('Excel export error:', err);
      req.flash('error', 'Export failed');
      res.redirect('/admin/placement');
    }
  }

  async exportPDF(req, res) {
    try {
      const pdfBuffer = await service.exportPDF(req.query);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=placement_report.pdf');
      res.send(pdfBuffer);
    } catch (err) {
      console.error('PDF export error:', err);
      req.flash('error', 'PDF export failed: ' + err.message);
      res.redirect('/admin/placement');
    }
  }

  async exportSummaryPDF(req, res) {
    try {
      const pdfBuffer = await service.exportSummaryPDF(req.query);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=placement_summary.pdf');
      res.send(pdfBuffer);
    } catch (err) {
      console.error('Summary PDF error:', err);
      req.flash('error', 'Summary PDF failed: ' + err.message);
      res.redirect('/admin/placement');
    }
  }
}

module.exports = new PlacementController();
