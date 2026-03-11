const express = require('express');
const router = express.Router();
const controller = require('../controllers/jobAggregatorController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated);

// ─── Student Pages ───────────────────────────────────────────
router.get('/', controller.index.bind(controller));
router.get('/saved', controller.savedJobs.bind(controller));
router.get('/applications', controller.myApplications.bind(controller));
router.get('/view/:id', controller.viewJob.bind(controller));

// ─── Student API ─────────────────────────────────────────────
router.get('/api/search', controller.apiSearch.bind(controller));
router.post('/api/:id/apply', controller.apiApply.bind(controller));
router.post('/api/:id/save', controller.apiSaveJob.bind(controller));
router.delete('/api/:id/save', controller.apiUnsaveJob.bind(controller));
router.post('/api/match', controller.apiMatchJob.bind(controller));

// ─── Admin Routes ────────────────────────────────────────────
router.get('/admin', isAdmin, controller.adminIndex.bind(controller));
router.post('/admin/jobs', isAdmin, controller.adminCreateJob.bind(controller));
router.put('/admin/jobs/:id', isAdmin, controller.adminUpdateJob.bind(controller));
router.delete('/admin/jobs/:id', isAdmin, controller.adminDeleteJob.bind(controller));
router.patch('/admin/jobs/:id/toggle', isAdmin, controller.adminToggleActive.bind(controller));
router.patch('/admin/jobs/:id/verify', isAdmin, controller.adminVerifyJob.bind(controller));
router.post('/admin/bulk-import', isAdmin, controller.adminBulkImport.bind(controller));
router.get('/admin/api/stats', isAdmin, controller.adminStats.bind(controller));

module.exports = router;
