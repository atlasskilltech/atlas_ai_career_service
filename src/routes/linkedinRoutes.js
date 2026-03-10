const express = require('express');
const router = express.Router();
const linkedinController = require('../controllers/linkedinController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', linkedinController.index);
router.post('/optimize', linkedinController.optimize);

module.exports = router;
