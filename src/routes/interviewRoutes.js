const express = require('express');
const router = express.Router();
const { controller, audioUpload } = require('../controllers/interviewController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', controller.index);
router.get('/new', controller.getNew);
router.post('/start', controller.start);
router.get('/feedback/all', controller.allFeedback);
router.get('/:id/session', controller.session);
router.get('/:id/question', controller.getQuestion);
router.get('/:id/question/:qid/audio', controller.questionAudio);
router.post('/:id/transcribe', audioUpload.single('audio'), controller.transcribe);
router.post('/:id/answer', controller.submitAnswer);
router.post('/:id/end', controller.end);
router.get('/:id/report', controller.report);

module.exports = router;
