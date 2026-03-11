const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const atsController = require('../controllers/atsController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

// Resume CRUD
router.get('/', resumeController.index);
router.get('/new', resumeController.create);
router.post('/', resumeController.store);
router.get('/:id/edit', resumeController.edit);
router.put('/:id', resumeController.update);
router.delete('/:id', resumeController.delete);
router.post('/:id/primary', resumeController.setPrimary);
router.post('/:id/duplicate', resumeController.duplicate);
router.get('/:id/preview', resumeController.preview);
router.get('/:id/preview-template', resumeController.previewTemplate);
router.get('/:id/data', resumeController.getResumeData);

// PDF Export
router.get('/:id/export', resumeController.exportPDF);

// Version History
router.post('/:id/version', resumeController.saveVersion);
router.get('/:id/versions', resumeController.getVersions);
router.post('/:id/version/:versionId/restore', resumeController.restoreVersion);

// AI Tools
router.post('/ai/bullets', resumeController.generateBullets);
router.post('/ai/summary', resumeController.generateSummary);
router.post('/ai/rewrite', resumeController.rewriteAchievement);
router.post('/ai/project', resumeController.generateProjectDesc);
router.post('/ai/skills', resumeController.suggestSkills);
router.post('/ai/analyze', resumeController.analyzeATS);
router.post('/:id/analyze', resumeController.analyzeATS);

// ATS Module
router.get('/ats', atsController.index);
router.post('/api/analyze', atsController.analyze);

module.exports = router;
