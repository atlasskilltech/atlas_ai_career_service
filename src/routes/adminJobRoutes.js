const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/jobMgmtController');

// Pages
router.get('/', ctrl.index.bind(ctrl));
router.get('/create', ctrl.createPage.bind(ctrl));
router.get('/export', ctrl.exportExcel.bind(ctrl));
router.get('/:id', ctrl.detailPage.bind(ctrl));
router.get('/:id/edit', ctrl.editPage.bind(ctrl));

// JSON APIs
router.post('/api/create', ctrl.apiCreate.bind(ctrl));
router.get('/api/:id', ctrl.apiGetJob.bind(ctrl));
router.put('/api/:id', ctrl.apiUpdate.bind(ctrl));
router.patch('/api/:id/status', ctrl.apiUpdateStatus.bind(ctrl));
router.delete('/api/:id', ctrl.apiDelete.bind(ctrl));
router.get('/api/:id/applicants', ctrl.apiGetApplicants.bind(ctrl));
router.patch('/api/applicants/:appId/stage', ctrl.apiMoveApplicant.bind(ctrl));
router.patch('/api/applicants/:appId/note', ctrl.apiAddNote.bind(ctrl));
router.post('/api/:id/shortlist', ctrl.apiBulkShortlist.bind(ctrl));

module.exports = router;
