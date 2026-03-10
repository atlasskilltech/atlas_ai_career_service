const express = require('express');
const router = express.Router();
const coverLetterController = require('../controllers/coverLetterController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', coverLetterController.index);
router.get('/new', coverLetterController.getNew);
router.post('/generate', coverLetterController.generate);
router.get('/:id', coverLetterController.view);
router.put('/:id', coverLetterController.update);
router.delete('/:id', coverLetterController.delete);

module.exports = router;
