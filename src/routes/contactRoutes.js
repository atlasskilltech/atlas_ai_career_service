const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', contactController.index);
router.post('/', contactController.create);
router.get('/:id', contactController.view);
router.put('/:id', contactController.update);
router.delete('/:id', contactController.delete);
router.post('/:id/interactions', contactController.addInteraction);

module.exports = router;
