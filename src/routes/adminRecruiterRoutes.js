const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/recruiterMgmtController');

// API routes first (before :id param catch-all)
router.get('/api/list', ctrl.apiList.bind(ctrl));
router.post('/api/create', ctrl.apiCreate.bind(ctrl));
router.post('/api/recalc-tiers', ctrl.apiRecalcTiers.bind(ctrl));
router.patch('/api/interactions/:interactionId/done', ctrl.apiMarkFollowUp.bind(ctrl));
router.get('/api/:id', ctrl.apiGet.bind(ctrl));
router.put('/api/:id', ctrl.apiUpdate.bind(ctrl));
router.get('/api/:id/stats', ctrl.apiStats.bind(ctrl));
router.get('/api/:id/jobs', ctrl.apiJobs.bind(ctrl));
router.post('/api/:id/interactions', ctrl.apiAddInteraction.bind(ctrl));

// Pages
router.get('/', ctrl.index.bind(ctrl));
router.get('/:id', ctrl.profile.bind(ctrl));

module.exports = router;
