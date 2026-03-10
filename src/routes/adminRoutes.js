const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.use(isAuthenticated, isAdmin);

router.get('/', adminController.index);
router.get('/students', adminController.students);
router.get('/api/stats', adminController.apiStats);

module.exports = router;
