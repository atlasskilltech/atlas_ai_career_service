const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/interviewMgmtController');

// ─── Page routes ─────────────────────────────────────────
router.get('/', ctrl.listPage.bind(ctrl));
router.get('/calendar', ctrl.calendarPage.bind(ctrl));
router.get('/feedback/:token', ctrl.feedbackPage.bind(ctrl));

// ─── API routes ──────────────────────────────────────────
router.post('/api/schedule', ctrl.apiSchedule.bind(ctrl));
router.get('/api/list', ctrl.apiList.bind(ctrl));
router.get('/api/calendar', ctrl.apiCalendar.bind(ctrl));
router.get('/api/students/:jobId', ctrl.apiStudentsForJob.bind(ctrl));
router.get('/api/:id', ctrl.apiDetail.bind(ctrl));
router.put('/api/:id/reschedule', ctrl.apiReschedule.bind(ctrl));
router.patch('/api/:id/status', ctrl.apiUpdateStatus.bind(ctrl));
router.post('/api/:id/feedback', ctrl.apiSubmitFeedback.bind(ctrl));
router.post('/api/:id/send-feedback-link', ctrl.apiSendFeedbackLink.bind(ctrl));
router.delete('/api/:id', ctrl.apiDelete.bind(ctrl));

module.exports = router;
