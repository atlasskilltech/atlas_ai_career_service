const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', interviewController.index);
router.get('/new', interviewController.getNew);
router.post('/start', interviewController.start);
router.get('/:id/session', interviewController.session);
router.post('/:id/answer', interviewController.submitAnswer);
router.post('/:id/complete', interviewController.complete);
router.get('/:id/feedback', interviewController.feedback);
router.get('/feedback/all', interviewController.allFeedback);

module.exports = router;
