const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/studentMgmtController');

// Page
router.get('/', ctrl.index.bind(ctrl));

// JSON APIs
router.get('/api/list', ctrl.apiList.bind(ctrl));
router.get('/api/:id', ctrl.apiProfile.bind(ctrl));
router.post('/api/filter', ctrl.apiFilter.bind(ctrl));
router.post('/api/bulk-action', ctrl.apiBulkAction.bind(ctrl));
router.post('/api/:id/skills', ctrl.apiAddSkill.bind(ctrl));
router.delete('/api/:id/skills/:skillId', ctrl.apiRemoveSkill.bind(ctrl));
router.get('/export', ctrl.exportExcel.bind(ctrl));

module.exports = router;
