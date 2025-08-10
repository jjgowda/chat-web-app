const express = require('express');
const path = require('path');

const app = express();
let clients = [];
let users = new Map(); // Store user info
let messages = new Map(); // Store messages by chat room
let userList = [];

app.use(express.static('public'));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
    const username = req.query.username;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    const clientData = { res, username };
    clients.push(clientData);

    // Add user to online list
    if (username && !userList.find(u => u.username === username)) {
        userList.push({ username, timestamp: Date.now() });
        broadcastUserList();
    }

    req.on('close', () => {
        clients = clients.filter(client => client !== clientData);
        // Remove user from online list
        userList = userList.filter(u => u.username !== username);
        broadcastUserList();
    });
});

// Send message to specific users or public chat
app.post('/send-message', (req, res) => {
    const { message, from, to, isPrivate } = req.body;
    
    const messageData = {
        message,
        from,
        to: isPrivate ? to : 'public',
        timestamp: Date.now(),
        isPrivate
    };

    // Store message
    const chatKey = isPrivate ? getChatKey(from, to) : 'public';
    if (!messages.has(chatKey)) {
        messages.set(chatKey, []);
    }
    messages.get(chatKey).push(messageData);

    // Send to appropriate clients
    if (isPrivate) {
        // Send to specific user and sender
        clients.forEach(client => {
            if (client.username === from || client.username === to) {
                client.res.write(`data: ${JSON.stringify({ type: 'message', data: messageData })}\n\n`);
            }
        });
    } else {
        // Send to all clients (public chat)
        clients.forEach(client => {
            client.res.write(`data: ${JSON.stringify({ type: 'message', data: messageData })}\n\n`);
        });
    }
    
    res.json({ success: true });
});

// Get chat history
app.get('/chat-history', (req, res) => {
    const { user1, user2 } = req.query;
    const chatKey = user2 ? getChatKey(user1, user2) : 'public';
    const chatHistory = messages.get(chatKey) || [];
    res.json(chatHistory);
});

// Register username
app.post('/register', (req, res) => {
    const { username } = req.body;
    
    if (userList.find(u => u.username === username)) {
        return res.json({ success: false, message: 'Username already taken' });
    }
    
    res.json({ success: true });
});

function getChatKey(user1, user2) {
    return [user1, user2].sort().join('-');
}

function broadcastUserList() {
    const data = JSON.stringify({ type: 'userList', data: userList });
    clients.forEach(client => {
        client.res.write(`data: ${data}\n\n`);
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
