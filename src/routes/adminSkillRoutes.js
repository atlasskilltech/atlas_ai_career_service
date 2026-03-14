const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/skillGapController');

// API routes first (before any :param routes)
router.get('/api/demand', ctrl.apiDemand.bind(ctrl));
router.get('/api/gap', ctrl.apiGap.bind(ctrl));
router.get('/api/heatmap', ctrl.apiHeatmap.bind(ctrl));
router.get('/api/trends', ctrl.apiTrends.bind(ctrl));
router.post('/api/recompute', ctrl.apiRecompute.bind(ctrl));
router.get('/api/ai-insights', ctrl.apiInsights.bind(ctrl));

// Export
router.get('/export', ctrl.exportExcel.bind(ctrl));

// Pages
router.get('/', ctrl.dashboard.bind(ctrl));
router.get('/heatmap', ctrl.heatmapPage.bind(ctrl));
router.get('/insights', ctrl.insightsPage.bind(ctrl));

module.exports = router;
