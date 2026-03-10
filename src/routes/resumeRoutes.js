const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const atsController = require('../controllers/atsController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', resumeController.index);
router.get('/new', resumeController.create);
router.post('/', resumeController.store);
router.get('/:id/edit', resumeController.edit);
router.put('/:id', resumeController.update);
router.delete('/:id', resumeController.delete);
router.post('/:id/primary', resumeController.setPrimary);
router.get('/:id/preview', resumeController.preview);

// AI Tools
router.post('/ai/bullets', resumeController.generateBullets);
router.post('/ai/summary', resumeController.generateSummary);
router.post('/ai/rewrite', resumeController.rewriteAchievement);

// ATS
router.get('/ats', atsController.index);
router.post('/api/analyze', atsController.analyze);

module.exports = router;
