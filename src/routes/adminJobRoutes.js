const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/jobMgmtController');

// Logo upload config
const logoStorage = multer.diskStorage({
  destination: path.join(__dirname, '../../public/uploads/logos'),
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, 'logo-' + Date.now() + ext);
  },
});
const logoUpload = multer({
  storage: logoStorage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype.split('/')[1])) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Pages
router.get('/', ctrl.index.bind(ctrl));
router.get('/create', ctrl.createPage.bind(ctrl));
router.get('/export', ctrl.exportExcel.bind(ctrl));
router.get('/:id', ctrl.detailPage.bind(ctrl));
router.get('/:id/edit', ctrl.editPage.bind(ctrl));

// JSON APIs
router.post('/api/create', logoUpload.single('company_logo_file'), ctrl.apiCreate.bind(ctrl));
router.get('/api/:id', ctrl.apiGetJob.bind(ctrl));
router.put('/api/:id', logoUpload.single('company_logo_file'), ctrl.apiUpdate.bind(ctrl));
router.patch('/api/:id/status', ctrl.apiUpdateStatus.bind(ctrl));
router.delete('/api/:id', ctrl.apiDelete.bind(ctrl));
router.get('/api/:id/applicants', ctrl.apiGetApplicants.bind(ctrl));
router.patch('/api/applicants/:appId/stage', ctrl.apiMoveApplicant.bind(ctrl));
router.patch('/api/applicants/:appId/note', ctrl.apiAddNote.bind(ctrl));
router.post('/api/:id/shortlist', ctrl.apiBulkShortlist.bind(ctrl));

module.exports = router;
