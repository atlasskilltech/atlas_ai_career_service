const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', jobController.index);
router.post('/', jobController.create);
router.get('/:id', jobController.view);
router.put('/:id', jobController.update);
router.patch('/:id/status', jobController.updateStatus);
router.delete('/:id', jobController.delete);
router.post('/:id/tasks', jobController.addTask);
router.patch('/tasks/:taskId/toggle', jobController.toggleTask);
router.post('/match/analyze', jobController.analyzeMatch);

module.exports = router;
