const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Prevent process crashes from killing the server
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Make io accessible to routes
app.set('io', io);

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'atlas-career-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 },
}));

app.use(flash());

// Global template variables
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  next();
});

// Routes
app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('pages/landing', { title: 'Atlas Career Platform', layout: 'layouts/main' });
});

app.use('/auth', require('./routes/authRoutes'));
app.use('/dashboard', require('./routes/dashboardRoutes'));
app.use('/resume', require('./routes/resumeRoutes'));
app.use('/cover-letter', require('./routes/coverLetterRoutes'));
app.use('/linkedin', require('./routes/linkedinRoutes'));
app.use('/jobs', require('./routes/jobRoutes'));
app.use('/networking', require('./routes/contactRoutes'));
app.use('/interview', require('./routes/interviewRoutes'));
app.use('/skills', require('./routes/skillRoutes'));
app.use('/documents', require('./routes/documentRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// Error handling
app.use(notFound);
app.use(errorHandler);

// Socket.IO for real-time interview
const setupInterviewSocket = require('./sockets/interviewSocket');
setupInterviewSocket(io);

const PORT = process.env.PORT || 3000;
// Increase server timeout to 60s for long AI operations (upload-parse, etc.)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.listen(PORT, () => {
  console.log(`Atlas Career Platform running on http://localhost:${PORT}`);
});

module.exports = app;
