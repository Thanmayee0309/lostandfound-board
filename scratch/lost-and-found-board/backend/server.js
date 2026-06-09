require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { connectDB } = require('./config/db');
const routes = require('./routes/routes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Files (Uploaded images)
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api', routes);

// Fallback Route for non-existing endpoints
app.use('*', (req, res) => {
  res.status(404).json({ message: 'API Endpoint not found' });
});

// Port configuration
const PORT = process.env.PORT || 5000;

// Connect to Database and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Server is running in environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Port: ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}/api`);
    console.log(`Uploads URL: http://localhost:${PORT}/uploads`);
    console.log(`=========================================`);
  });
}).catch(err => {
  console.error('Failed to initialize application:', err);
  process.exit(1);
});
