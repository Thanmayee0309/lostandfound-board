const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dbConfig = require('../config/db');

// ==========================================
// 1. MONGOOSE SCHEMA DEFINITIONS
// ==========================================

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user', enum: ['user', 'admin'] },
  createdAt: { type: Date, default: Date.now }
});

const ItemSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  type: { type: String, required: true, enum: ['lost', 'found'] },
  date: { type: Date, required: true },
  locationText: { type: String, required: true },
  latitude: { type: Number },
  longitude: { type: Number },
  imageUrl: { type: String },
  status: { type: String, default: 'open', enum: ['open', 'claimed', 'resolved'] },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

const ClaimSchema = new mongoose.Schema({
  itemId: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  verificationAnswer: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  createdAt: { type: Date, default: Date.now }
});

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['claim', 'match'] },
  relatedId: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const MessageSchema = new mongoose.Schema({
  claimId: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const MongoUser = mongoose.model('User', UserSchema);
const MongoItem = mongoose.model('Item', ItemSchema);
const MongoClaim = mongoose.model('Claim', ClaimSchema);
const MongoNotification = mongoose.model('Notification', NotificationSchema);
const MongoMessage = mongoose.model('Message', MessageSchema);

// ==========================================
// 2. FALLBACK JSON DATABASE CONTROLLER
// ==========================================

const DB_FILE = path.join(__dirname, '../data/database_fallback.json');

function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (!parsed.messages) parsed.messages = [];
    return parsed;
  } catch (err) {
    return { users: [], items: [], claims: [], notifications: [], messages: [] };
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// Emulate DB population (join)
function populateUser(userId, db) {
  const user = db.users.find(u => u._id === userId);
  if (!user) return null;
  return { _id: user._id, username: user.username, email: user.email, role: user.role };
}

function populateItem(itemId, db) {
  const item = db.items.find(i => i._id === itemId);
  if (!item) return null;
  return { ...item, userId: populateUser(item.userId, db) };
}

// ==========================================
// 3. UNIFIED WRAPPER MODELS (DYNAMICS ROUTES)
// ==========================================

const User = {
  async findOne(filter) {
    if (!dbConfig.useFallback()) {
      return await MongoUser.findOne(filter);
    }
    const db = readDb();
    const found = db.users.find(u => {
      for (let key in filter) {
        if (u[key] !== filter[key]) return false;
      }
      return true;
    });
    return found ? { ...found } : null;
  },

  async findById(id) {
    if (!dbConfig.useFallback()) {
      return await MongoUser.findById(id);
    }
    const db = readDb();
    const found = db.users.find(u => u._id === id);
    return found ? { ...found } : null;
  },

  async create(data) {
    if (!dbConfig.useFallback()) {
      return await MongoUser.create(data);
    }
    const db = readDb();
    
    // Check uniqueness of email
    if (db.users.some(u => u.email === data.email)) {
      throw new Error('Email already registered');
    }
    
    const newUser = {
      _id: generateId(),
      ...data,
      role: data.role || 'user',
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDb(db);
    return { ...newUser };
  }
};

const Item = {
  async find(filter = {}) {
    if (!dbConfig.useFallback()) {
      return await MongoItem.find(filter).populate('userId', 'username email').sort({ createdAt: -1 });
    }
    const db = readDb();
    let results = db.items;
    
    // Simple filter matching
    if (Object.keys(filter).length > 0) {
      results = results.filter(item => {
        for (let key in filter) {
          if (filter[key] !== undefined && item[key] !== filter[key]) {
            return false;
          }
        }
        return true;
      });
    }
    
    // Populate and sort
    const populated = results.map(item => ({
      ...item,
      userId: populateUser(item.userId, db)
    }));
    
    return populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async findById(id) {
    if (!dbConfig.useFallback()) {
      return await MongoItem.findById(id).populate('userId', 'username email');
    }
    const db = readDb();
    const item = db.items.find(i => i._id === id);
    if (!item) return null;
    return {
      ...item,
      userId: populateUser(item.userId, db)
    };
  },

  async create(data) {
    if (!dbConfig.useFallback()) {
      return await MongoItem.create(data);
    }
    const db = readDb();
    const newItem = {
      _id: generateId(),
      status: 'open',
      createdAt: new Date().toISOString(),
      ...data
    };
    db.items.push(newItem);
    writeDb(db);
    return { ...newItem, userId: populateUser(newItem.userId, db) };
  },

  async findByIdAndUpdate(id, updateData, options = { new: true }) {
    if (!dbConfig.useFallback()) {
      return await MongoItem.findByIdAndUpdate(id, updateData, options).populate('userId', 'username email');
    }
    const db = readDb();
    const index = db.items.findIndex(i => i._id === id);
    if (index === -1) return null;
    
    db.items[index] = {
      ...db.items[index],
      ...updateData
    };
    writeDb(db);
    return { ...db.items[index], userId: populateUser(db.items[index].userId, db) };
  },

  async findByIdAndDelete(id) {
    if (!dbConfig.useFallback()) {
      return await MongoItem.findByIdAndDelete(id);
    }
    const db = readDb();
    const index = db.items.findIndex(i => i._id === id);
    if (index === -1) return null;
    const deleted = db.items.splice(index, 1)[0];
    writeDb(db);
    return deleted;
  }
};

const Claim = {
  async find(filter = {}) {
    if (!dbConfig.useFallback()) {
      return await MongoClaim.find(filter)
        .populate('itemId')
        .populate('claimantId', 'username email')
        .populate('ownerId', 'username email')
        .sort({ createdAt: -1 });
    }
    const db = readDb();
    let results = db.claims;
    
    if (Object.keys(filter).length > 0) {
      results = results.filter(claim => {
        for (let key in filter) {
          if (filter[key] !== undefined && claim[key] !== filter[key]) {
            return false;
          }
        }
        return true;
      });
    }

    const populated = results.map(claim => ({
      ...claim,
      itemId: populateItem(claim.itemId, db),
      claimantId: populateUser(claim.claimantId, db),
      ownerId: populateUser(claim.ownerId, db)
    }));
    
    return populated.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async findById(id) {
    if (!dbConfig.useFallback()) {
      return await MongoClaim.findById(id)
        .populate('itemId')
        .populate('claimantId', 'username email')
        .populate('ownerId', 'username email');
    }
    const db = readDb();
    const claim = db.claims.find(c => c._id === id);
    if (!claim) return null;
    return {
      ...claim,
      itemId: populateItem(claim.itemId, db),
      claimantId: populateUser(claim.claimantId, db),
      ownerId: populateUser(claim.ownerId, db)
    };
  },

  async create(data) {
    if (!dbConfig.useFallback()) {
      return await MongoClaim.create(data);
    }
    const db = readDb();
    const newClaim = {
      _id: generateId(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      ...data
    };
    db.claims.push(newClaim);
    writeDb(db);
    return {
      ...newClaim,
      itemId: populateItem(newClaim.itemId, db),
      claimantId: populateUser(newClaim.claimantId, db),
      ownerId: populateUser(newClaim.ownerId, db)
    };
  },

  async findByIdAndUpdate(id, updateData, options = { new: true }) {
    if (!dbConfig.useFallback()) {
      return await MongoClaim.findByIdAndUpdate(id, updateData, options)
        .populate('itemId')
        .populate('claimantId', 'username email')
        .populate('ownerId', 'username email');
    }
    const db = readDb();
    const index = db.claims.findIndex(c => c._id === id);
    if (index === -1) return null;
    
    db.claims[index] = {
      ...db.claims[index],
      ...updateData
    };
    writeDb(db);
    return {
      ...db.claims[index],
      itemId: populateItem(db.claims[index].itemId, db),
      claimantId: populateUser(db.claims[index].claimantId, db),
      ownerId: populateUser(db.claims[index].ownerId, db)
    };
  }
};

const Notification = {
  async find(filter = {}) {
    if (!dbConfig.useFallback()) {
      return await MongoNotification.find(filter).sort({ createdAt: -1 });
    }
    const db = readDb();
    let results = db.notifications;
    
    if (Object.keys(filter).length > 0) {
      results = results.filter(n => {
        for (let key in filter) {
          if (filter[key] !== undefined && n[key] !== filter[key]) {
            return false;
          }
        }
        return true;
      });
    }
    
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async create(data) {
    if (!dbConfig.useFallback()) {
      return await MongoNotification.create(data);
    }
    const db = readDb();
    const newNotif = {
      _id: generateId(),
      read: false,
      createdAt: new Date().toISOString(),
      ...data
    };
    db.notifications.push(newNotif);
    writeDb(db);
    return { ...newNotif };
  },

  async findByIdAndUpdate(id, updateData, options = { new: true }) {
    if (!dbConfig.useFallback()) {
      return await MongoNotification.findByIdAndUpdate(id, updateData, options);
    }
    const db = readDb();
    const index = db.notifications.findIndex(n => n._id === id);
    if (index === -1) return null;
    
    db.notifications[index] = {
      ...db.notifications[index],
      ...updateData
    };
    writeDb(db);
    return { ...db.notifications[index] };
  }
};

const Message = {
  async find(filter = {}) {
    if (!dbConfig.useFallback()) {
      return await MongoMessage.find(filter).populate('senderId', 'username email').sort({ createdAt: 1 });
    }
    const db = readDb();
    let results = db.messages || [];
    
    if (Object.keys(filter).length > 0) {
      results = results.filter(msg => {
        for (let key in filter) {
          if (filter[key] !== undefined && msg[key] !== filter[key]) {
            return false;
          }
        }
        return true;
      });
    }

    const populated = results.map(msg => ({
      ...msg,
      senderId: populateUser(msg.senderId, db)
    }));
    
    return populated.sort((a, b) => new Date(a.createdAt) - new Date(a.createdAt));
  },

  async create(data) {
    if (!dbConfig.useFallback()) {
      return await MongoMessage.create(data);
    }
    const db = readDb();
    if (!db.messages) db.messages = [];
    const newMsg = {
      _id: generateId(),
      createdAt: new Date().toISOString(),
      ...data
    };
    db.messages.push(newMsg);
    writeDb(db);
    return {
      ...newMsg,
      senderId: populateUser(newMsg.senderId, db)
    };
  }
};

module.exports = {
  User,
  Item,
  Claim,
  Notification,
  Message
};
