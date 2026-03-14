const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/placementController');

// API routes
router.get('/api/summary', ctrl.apiSummary.bind(ctrl));
router.get('/api/breakdown', ctrl.apiBreakdown.bind(ctrl));
router.get('/api/companies', ctrl.apiCompanies.bind(ctrl));
router.get('/api/trends', ctrl.apiTrends.bind(ctrl));

// Export routes
router.get('/export/excel', ctrl.exportExcel.bind(ctrl));
router.get('/export/pdf', ctrl.exportPDF.bind(ctrl));
router.get('/export/summary', ctrl.exportSummaryPDF.bind(ctrl));

// Pages
router.get('/', ctrl.analytics.bind(ctrl));
router.get('/reports', ctrl.reportsPage.bind(ctrl));

module.exports = router;
