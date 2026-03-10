const express = require('express');
const router = express.Router();
const skillController = require('../controllers/skillController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', skillController.index);
router.post('/analyze', skillController.analyze);

module.exports = router;
