const express = require('express');
const path = require('path');

const app = express();
let clients = [];
let messages = [];

app.use(express.static('public'));
app.use(express.json());

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSE endpoint for real-time updates
app.get('/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
    });

    clients.push(res);

    req.on('close', () => {
        clients = clients.filter(client => client !== res);
    });
});

// API endpoint to send messages
app.post('/send-message', (req, res) => {
    const message = req.body.message;
    messages.push(message);
    
    // Send to all connected clients
    clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ message })}\n\n`);
    });
    
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
