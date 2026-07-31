require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const webhookRoutes = require('./routes/webhook');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: { origin: "*" }
});

// Pass Socket.io instance (req.io) to all routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(bodyParser.json());
app.use(express.static('public'));

app.use('/', webhookRoutes);
app.use('/', adminRoutes);

app.get('/', (req, res) => {
  res.send('JustFath RC/DL Bot server is running ✅');
});

// Socket.io connection logging
io.on('connection', (socket) => {
  console.log('⚡ Admin Dashboard connected via WebSocket:', socket.id);
});

const PORT = process.env.PORT || 3000;

// MUST use server.listen instead of app.listen for WebSockets to work!
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});