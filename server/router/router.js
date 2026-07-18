const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Auth routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Protected routes (example)
// router.post('/upload', authMiddleware, fileController.upload);

module.exports = router;