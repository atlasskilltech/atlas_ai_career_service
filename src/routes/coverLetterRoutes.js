const express = require('express');
const router = express.Router();
const coverLetterController = require('../controllers/coverLetterController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

// Pages
router.get('/', coverLetterController.index);
router.get('/new', coverLetterController.getNew);
router.get('/:id', coverLetterController.view);

// Generate & CRUD
router.post('/generate', coverLetterController.generate);
router.put('/:id', coverLetterController.update);
router.delete('/:id', coverLetterController.delete);

// Regenerate with different tone
router.post('/:id/regenerate', coverLetterController.regenerate);

// Version management
router.post('/:id/version', coverLetterController.saveVersion);
router.get('/:id/versions', coverLetterController.getVersions);
router.post('/:id/restore/:versionId', coverLetterController.restoreVersion);

// PDF export
router.post('/:id/export', coverLetterController.exportPDF);

module.exports = router;
