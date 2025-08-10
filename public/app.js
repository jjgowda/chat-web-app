let currentUser = '';
let currentChat = 'public';
let eventSource = null;

// DOM Elements
const usernameModal = document.getElementById('username-modal');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const errorMsg = document.getElementById('error-msg');
const chatApp = document.getElementById('chat-app');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const userList = document.getElementById('user-list');
const chatTitle = document.getElementById('chat-title');
const currentUserDisplay = document.getElementById('current-user');

// Initialize app
init();

function init() {
    joinBtn.addEventListener('click', registerUser);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') registerUser();
    });
    
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

async function registerUser() {
    const username = usernameInput.value.trim();
    
    if (!username) {
        showError('Please enter a username');
        return;
    }
    
    if (username.length < 2) {
        showError('Username must be at least 2 characters');
        return;
    }

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = username;
            currentUserDisplay.textContent = `Logged in as: ${username}`;
            usernameModal.style.display = 'none';
            chatApp.style.display = 'block';
            connectToChat();
        } else {
            showError(result.message);
        }
    } catch (error) {
        showError('Connection error. Please try again.');
    }
}

function showError(message) {
    errorMsg.textContent = message;
    setTimeout(() => errorMsg.textContent = '', 3000);
}

function connectToChat() {
    eventSource = new EventSource(`/events?username=${currentUser}`);
    
    eventSource.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'message') {
            handleNewMessage(data.data);
        } else if (data.type === 'userList') {
            updateUserList(data.data);
        }
    };
    
    // Load initial chat history
    loadChatHistory();
}

function handleNewMessage(messageData) {
    // Only show message if it's for current chat
    const isForCurrentChat = 
        (currentChat === 'public' && !messageData.isPrivate) ||
        (messageData.isPrivate && (
            (messageData.from === currentUser && messageData.to === currentChat) ||
            (messageData.to === currentUser && messageData.from === currentChat)
        ));
    
    if (isForCurrentChat) {
        displayMessage(messageData);
    }
}

function displayMessage(messageData) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (messageData.from === currentUser) {
        messageDiv.classList.add('own');
    } else {
        messageDiv.classList.add('other');
    }
    
    if (messageData.isPrivate) {
        messageDiv.classList.add('private');
    }
    
    const time = new Date(messageData.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    messageDiv.innerHTML = `
        <div class="message-header">${messageData.from} • ${time}</div>
        <div>${messageData.message}</div>
    `;
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function updateUserList(users) {
    // Clear current list (except public chat)
    const publicChatItem = userList.querySelector('[data-user="public"]');
    userList.innerHTML = '';
    userList.appendChild(publicChatItem);
    
    // Add users
    users.forEach(user => {
        if (user.username !== currentUser) {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.dataset.user = user.username;
            userItem.innerHTML = `<span>👤 ${user.username}</span>`;
            userItem.addEventListener('click', () => switchChat(user.username));
            userList.appendChild(userItem);
        }
    });
}

function switchChat(chatUser) {
    // Update active chat
    document.querySelectorAll('.user-item').forEach(item => item.classList.remove('active'));
    
    if (chatUser === 'public') {
        document.querySelector('[data-user="public"]').classList.add('active');
        chatTitle.textContent = 'Public Chat';
        currentChat = 'public';
    } else {
        document.querySelector(`[data-user="${chatUser}"]`).classList.add('active');
        chatTitle.textContent = `Private Chat with ${chatUser}`;
        currentChat = chatUser;
    }
    
    // Clear messages and load chat history
    messages.innerHTML = '';
    loadChatHistory();
}

async function loadChatHistory() {
    try {
        const url = currentChat === 'public' 
            ? '/chat-history?user1=public'
            : `/chat-history?user1=${currentUser}&user2=${currentChat}`;
            
        const response = await fetch(url);
        const history = await response.json();
        
        history.forEach(messageData => {
            displayMessage(messageData);
        });
    } catch (error) {
        console.error('Error loading chat history:', error);
    }
}

async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;
    
    try {
        const messageData = {
            message,
            from: currentUser,
            to: currentChat,
            isPrivate: currentChat !== 'public'
        };
        
        await fetch('/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData)
        });
        
        messageInput.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Handle public chat click
document.addEventListener('click', (e) => {
    if (e.target.closest('[data-user="public"]')) {
        switchChat('public');
    }
});
