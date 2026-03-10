const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', interviewController.index);
router.get('/new', interviewController.getNew);
router.post('/start', interviewController.start);
router.get('/feedback/all', interviewController.allFeedback);
router.get('/:id/session', interviewController.session);
router.get('/:id/question', interviewController.getQuestion);
router.post('/:id/answer', interviewController.submitAnswer);
router.post('/:id/end', interviewController.end);
router.get('/:id/report', interviewController.report);

module.exports = router;
