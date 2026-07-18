const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() }); // Stores in RAM
const authController = require('../controllers/auth.controller');
const { authMiddleware } = require('../middleware/auth.middleware');
const uploadController = require('../controllers/upload.controller');

// Auth routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);

// Add this to your router.js
router.get('/upload/initiate', authMiddleware, uploadController.initiateUpload);
router.post('/upload/presigned-url', authMiddleware, uploadController.getPresignedUrlForPart);
router.post('/upload/complete', authMiddleware, uploadController.completeUpload);

module.exports = router;