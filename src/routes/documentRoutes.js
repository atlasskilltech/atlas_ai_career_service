const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { isAuthenticated } = require('../middleware/auth');
const { documentUpload } = require('../config/multer');

router.use(isAuthenticated);

router.get('/', documentController.index);
router.post('/upload', documentUpload.single('file'), documentController.upload);
router.put('/:id', documentController.update);
router.delete('/:id', documentController.delete);

module.exports = router;
