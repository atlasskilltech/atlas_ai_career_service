const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminDashboardController = require('../controllers/adminDashboardController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated, isAdmin);

// Dashboard overview
router.get('/', adminDashboardController.index.bind(adminDashboardController));

// JSON APIs for auto-refresh & charts
router.get('/metrics', adminDashboardController.apiMetrics.bind(adminDashboardController));
router.get('/charts', adminDashboardController.apiCharts.bind(adminDashboardController));
router.get('/activity', adminDashboardController.apiActivity.bind(adminDashboardController));
router.get('/trend', adminDashboardController.apiTrend.bind(adminDashboardController));
router.get('/funnel', adminDashboardController.apiFunnel.bind(adminDashboardController));
router.post('/refresh', adminDashboardController.postRefresh.bind(adminDashboardController));

// Student Management (full sub-router)
router.use('/students', require('./adminStudentRoutes'));

// Job Management (full sub-router)
router.use('/jobs', require('./adminJobRoutes'));
router.get('/recruiters', adminController.recruiters);
router.get('/applications', adminController.applications);
router.get('/interviews', adminController.interviews);
router.get('/skill-gap', adminController.skillGap);
router.get('/placement', adminController.placement);
router.get('/communication', adminController.communication);
router.get('/settings', adminController.settings);

router.get('/api/stats', adminController.apiStats);

module.exports = router;
