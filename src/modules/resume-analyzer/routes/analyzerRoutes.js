const express = require('express');
const router = express.Router();
const analyzerController = require('../controllers/analyzerController');
const { isAuthenticated } = require('../../../middleware/auth');
const { resumeMemoryUpload } = require('../../../config/multer');

router.use(isAuthenticated);

// Page route - ATS Analyzer Dashboard
router.get('/', analyzerController.index.bind(analyzerController));

// API: Full ATS analysis (supports file upload + JSON body)
router.post('/api/analyze', (req, res, next) => {
  resumeMemoryUpload.single('resume')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
}, analyzerController.analyze.bind(analyzerController));

// API: Get analysis by ID
router.get('/api/analyze/:id', analyzerController.getAnalysis.bind(analyzerController));

// API: Get analysis history
router.get('/api/history', analyzerController.getHistory.bind(analyzerController));

// API: Add missing keywords/skills to resume
router.post('/api/add-keywords', analyzerController.addKeywordsToResume.bind(analyzerController));

// API: Apply content improvements (weak→strong rewrites) to resume
router.post('/api/apply-content', analyzerController.applyContentImprovements.bind(analyzerController));

// API: Fix ALL ATS issues at once (keywords + skills + content + formatting)
router.post('/api/fix-all', analyzerController.fixAll.bind(analyzerController));

module.exports = router;
