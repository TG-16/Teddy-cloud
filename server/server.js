require('dotenv').config();
const express = require('express');
const cors = require('cors');
const router = require('./router/router');

const app = express();

// Middleware
app.use(cors());
app.use(express.json()); // Parses incoming JSON requests

// Root route
app.get('/', (req, res) => {
    res.send('TeddyCloud API is running...');
});

// Mount the router
app.use('/api', router);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong on the server!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`TeddyCloud server running on port ${PORT}`);
});