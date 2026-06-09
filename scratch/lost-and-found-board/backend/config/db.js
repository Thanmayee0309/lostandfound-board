const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let isConnected = false;
let useFallback = false;

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/lostfound';
  console.log(`Attempting to connect to database...`);
  
  try {
    // Try to connect to MongoDB with a short 2-second timeout
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 2500
    });
    isConnected = true;
    console.log('MongoDB connected successfully!');
    return true;
  } catch (err) {
    console.warn('MongoDB connection failed (server not running or timed out).');
    console.warn('>>> FALLING BACK TO LOCAL JSON DATABASE STORAGE <<<');
    useFallback = true;
    
    // Ensure the data and uploads directory exist for local storage
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const uploadsDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const dbFile = path.join(dataDir, 'database_fallback.json');
    if (!fs.existsSync(dbFile)) {
      fs.writeFileSync(dbFile, JSON.stringify({
        users: [],
        items: [],
        claims: [],
        notifications: []
      }, null, 2));
      console.log('Created local fallback database file:', dbFile);
    }
    return false;
  }
};

module.exports = {
  connectDB,
  isConnected: () => isConnected,
  useFallback: () => useFallback
};
