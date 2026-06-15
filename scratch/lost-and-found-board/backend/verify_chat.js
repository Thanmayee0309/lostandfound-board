const { connectDB } = require('./config/db');
const { Message } = require('./models/models');

console.log('===================================================');
console.log('RUNNING CHAT MODEL VERIFICATION TEST');
console.log('===================================================\n');

async function runTest() {
  try {
    // 1. Initialize DB connection check (Mongo vs JSON Fallback)
    await connectDB();

    // 2. Create a mock message
    console.log('\nTest 1: Creating a verification chat message...');
    const mockMessage = await Message.create({
      claimId: 'claim_123_abc',
      senderId: 'user_456_xyz',
      text: 'Here is the unique logo sticker on the back of my laptop.'
    });

    console.log('Message created successfully:');
    console.log('ID:', mockMessage._id);
    console.log('Text:', mockMessage.text);
    console.log('Created At:', mockMessage.createdAt);
    console.log('---------------------------------------------------\n');

    // 3. Fetch messages in mock conversation
    console.log('Test 2: Querying message logs by Claim ID...');
    const messageList = await Message.find({ claimId: 'claim_123_abc' });
    console.log(`Found ${messageList.length} message(s) in conversation.`);
    
    if (messageList.length > 0 && messageList[0].text === 'Here is the unique logo sticker on the back of my laptop.') {
      console.log('✅ PASS: Message text matches.');
    } else {
      console.log('❌ FAIL: Message list query returned incorrect results.');
      process.exit(1);
    }
    
    console.log('\n===================================================');
    console.log('CHAT VERIFICATION TEST COMPLETED SUCCESSFULLY!');
    console.log('===================================================');
    
    // Terminate process cleanly so open Mongoose connection pools exit
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err.message);
    process.exit(1);
  }
}

runTest();
