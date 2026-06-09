const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { User, Item, Claim, Notification } = require('../models/models');
const { protect, admin } = require('../middleware/auth');
const aiEngine = require('../utils/aiEngine');

const JWT_SECRET = process.env.JWT_SECRET || 'campus_lost_found_jwt_secret_token_123!';

// Ensure upload directory exists
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|webp/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Images only (jpeg, jpg, png, webp)'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

// Register User
router.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    // Check if user exists
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      role: role || 'user'
    });

    // Generate JWT token
    const token = jwt.sign({ id: newUser._id }, JWT_SECRET, { expiresIn: '30d' });

    res.status(201).json({
      _id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login User
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: '30d' });

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Current User Profile
router.get('/auth/me', protect, async (req, res) => {
  res.json({
    _id: req.user._id,
    username: req.user.username,
    email: req.user.email,
    role: req.user.role
  });
});

// ==========================================
// LOST/FOUND ITEMS ENDPOINTS
// ==========================================

// Create an Item Post
router.post('/items', protect, upload.single('image'), async (req, res) => {
  try {
    const { title, description, category, type, date, locationText, latitude, longitude } = req.body;

    if (!title || !description || !category || !type || !date || !locationText) {
      return res.status(400).json({ message: 'All main fields are required' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : '';

    const newItem = await Item.create({
      title,
      description,
      category,
      type,
      date: new Date(date),
      locationText,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      imageUrl,
      userId: req.user._id
    });

    // TRIGGER AI ENGINE IN BACKGROUND FOR MATCH SUGGESTIONS
    // Fetch all items to compare
    const allItems = await Item.find({ status: 'open' });
    const suggestions = aiEngine.findMatches(newItem, allItems);
    
    // For top suggestions (score >= 0.35), send match notification to both users
    for (const match of suggestions) {
      if (match.score >= 0.35) {
        const matchingItem = match.item;
        
        // Notify owner of existing item
        await Notification.create({
          userId: matchingItem.userId._id || matchingItem.userId,
          message: `AI Match Suggestion (${Math.round(match.score * 100)}%): Your posted ${matchingItem.type} item "${matchingItem.title}" matches the newly posted ${newItem.type} item "${newItem.title}"! Check details.`,
          type: 'match',
          relatedId: newItem._id.toString()
        });

        // Notify poster of new item
        await Notification.create({
          userId: newItem.userId,
          message: `AI Match Suggestion (${Math.round(match.score * 100)}%): Your posted ${newItem.type} item "${newItem.title}" matches an existing ${matchingItem.type} item "${matchingItem.title}"! Check details.`,
          type: 'match',
          relatedId: matchingItem._id.toString()
        });
      }
    }

    res.status(201).json(newItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Items with Query Filter
router.get('/items', async (req, res) => {
  try {
    const { category, type, status, search } = req.query;
    const filter = {};
    
    if (category && category !== 'All') filter.category = category;
    if (type) filter.type = type;
    if (status) filter.status = status;

    let items = await Item.find(filter);

    // Simple search filtering
    if (search) {
      const searchLower = search.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(searchLower) || 
        item.description.toLowerCase().includes(searchLower) ||
        item.locationText.toLowerCase().includes(searchLower)
      );
    }

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get Single Item and its Matches
router.get('/items/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get AI Matches for Item
router.get('/items/:id/matches', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const allItems = await Item.find({ status: 'open' });
    const suggestions = aiEngine.findMatches(item, allItems);
    
    res.json(suggestions.map(s => ({
      item: s.item,
      score: s.score
    })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update Item Status (Mark Returned/Resolved)
router.put('/items/:id', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const item = await Item.findById(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const itemUserId = item.userId._id ? item.userId._id.toString() : item.userId.toString();

    // Verify ownership or admin privileges
    if (itemUserId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to modify this item' });
    }

    const updatedItem = await Item.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(updatedItem);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Item (Admin only or Owner)
router.delete('/items/:id', protect, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const itemUserId = item.userId._id ? item.userId._id.toString() : item.userId.toString();

    if (itemUserId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// CLAIMS ENDPOINTS
// ==========================================

// Submit a Claim
router.post('/claims', protect, async (req, res) => {
  try {
    const { itemId, verificationAnswer } = req.body;

    if (!itemId || !verificationAnswer) {
      return res.status(400).json({ message: 'Item ID and verification details are required' });
    }

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.status !== 'open') {
      return res.status(400).json({ message: 'Item is not open for claims' });
    }

    const itemOwnerId = item.userId._id ? item.userId._id.toString() : item.userId.toString();
    if (itemOwnerId === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot claim your own item' });
    }

    // Check if user already claimed this item
    const existingClaims = await Claim.find({ itemId, claimantId: req.user._id });
    if (existingClaims.length > 0) {
      return res.status(400).json({ message: 'You have already submitted a claim for this item' });
    }

    const claim = await Claim.create({
      itemId,
      claimantId: req.user._id,
      ownerId: itemOwnerId,
      verificationAnswer
    });

    // Update item status to 'claimed' (pending review)
    await Item.findByIdAndUpdate(itemId, { status: 'claimed' });

    // Notify item owner
    await Notification.create({
      userId: itemOwnerId,
      message: `New Claim submitted! Someone claimed your posted item: "${item.title}". Verify their answer.`,
      type: 'claim',
      relatedId: claim._id.toString()
    });

    res.status(201).json(claim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List Claims
// Users see claims they received (ownerId) or submitted (claimantId). Admins see all.
router.get('/claims', protect, async (req, res) => {
  try {
    let filter = {};
    if (req.user.role !== 'admin') {
      const type = req.query.type; // 'received' or 'sent'
      if (type === 'sent') {
        filter.claimantId = req.user._id;
      } else if (type === 'received') {
        filter.ownerId = req.user._id;
      } else {
        // Return both
        filter = {
          $or: [
            { claimantId: req.user._id },
            { ownerId: req.user._id }
          ]
        };
      }
    }

    const claims = await Claim.find(filter);
    res.json(claims);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Approve or Reject Claim
router.put('/claims/:id', protect, async (req, res) => {
  try {
    const { status } = req.body; // 'approved' or 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid claim status' });
    }

    const claim = await Claim.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    const claimOwnerId = claim.ownerId._id ? claim.ownerId._id.toString() : claim.ownerId.toString();

    // Verify caller is owner of item or admin
    if (claimOwnerId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to moderate this claim' });
    }

    const updatedClaim = await Claim.findByIdAndUpdate(req.params.id, { status }, { new: true });

    const itemId = claim.itemId._id || claim.itemId;
    
    if (status === 'approved') {
      // Mark item as resolved
      await Item.findByIdAndUpdate(itemId, { status: 'resolved' });

      // Reject all other pending claims on this item
      const otherClaims = await Claim.find({ itemId, _id: { $ne: claim._id }, status: 'pending' });
      for (const other of otherClaims) {
        await Claim.findByIdAndUpdate(other._id, { status: 'rejected' });
        
        // Notify other claimants
        await Notification.create({
          userId: other.claimantId._id || other.claimantId,
          message: `Your claim for item "${other.itemId.title}" was declined because it was returned to another owner.`,
          type: 'claim',
          relatedId: other._id.toString()
        });
      }

      // Notify successful claimant
      await Notification.create({
        userId: claim.claimantId._id || claim.claimantId,
        message: `Congratulations! Your claim for "${claim.itemId.title}" has been APPROVED. Arrange with owner to retrieve it.`,
        type: 'claim',
        relatedId: claim._id.toString()
      });
    } else {
      // Revert item status to 'open' if no other approved/claimed statuses are there
      // Check if there are other pending claims
      const pendingClaims = await Claim.find({ itemId, _id: { $ne: claim._id }, status: 'pending' });
      const nextStatus = pendingClaims.length > 0 ? 'claimed' : 'open';
      await Item.findByIdAndUpdate(itemId, { status: nextStatus });

      // Notify rejected claimant
      await Notification.create({
        userId: claim.claimantId._id || claim.claimantId,
        message: `Your claim for "${claim.itemId.title}" was rejected by the owner after review.`,
        type: 'claim',
        relatedId: claim._id.toString()
      });
    }

    res.json(updatedClaim);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==========================================
// NOTIFICATIONS ENDPOINTS
// ==========================================

// Get Current User Notifications
router.get('/notifications', protect, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark Notification as Read
router.put('/notifications/:id', protect, async (req, res) => {
  try {
    const updated = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark All Notifications as Read
router.put('/notifications', protect, async (req, res) => {
  try {
    const db = require('../models/models'); // Reload models context
    if (process.env.MONGO_URI && !require('../config/db').useFallback()) {
      // Mongoose bulk update
      const MongoNotificationModel = mongoose.model('Notification');
      await MongoNotificationModel.updateMany({ userId: req.user._id }, { read: true });
    } else {
      // JSON File bulk update
      const fs = require('fs');
      const DB_FILE = path.join(__dirname, '../data/database_fallback.json');
      const dbData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      dbData.notifications.forEach(n => {
        if (n.userId === req.user._id.toString()) {
          n.read = true;
        }
      });
      fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
    }
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
