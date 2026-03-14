const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pipelineController');

// Pages
router.get('/', ctrl.selectJob.bind(ctrl));
router.get('/:jobId/kanban', ctrl.kanbanPage.bind(ctrl));
router.get('/:jobId/timeline', ctrl.timelinePage.bind(ctrl));

// JSON APIs
router.get('/api/:jobId', ctrl.apiGetPipeline.bind(ctrl));
router.patch('/api/:appId/move', ctrl.apiMoveCard.bind(ctrl));
router.patch('/api/:jobId/reorder', ctrl.apiReorder.bind(ctrl));
router.patch('/api/:appId/priority', ctrl.apiUpdatePriority.bind(ctrl));
router.patch('/api/:appId/notes', ctrl.apiUpdateNotes.bind(ctrl));
router.get('/api/:appId/history', ctrl.apiGetHistory.bind(ctrl));
router.get('/api/:jobId/audit', ctrl.apiGetAuditLog.bind(ctrl));

module.exports = router;
