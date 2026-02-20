require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 5000;

// ===== DATABASE SETUP =====
const db = new Database(path.join(__dirname, 'data', 'contacts.db'));

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Insert default admin if not exists
const adminExists = db.prepare('SELECT id FROM admin_users WHERE username = ?').get('admin');
if (!adminExists) {
  // Default password: admin123 (change this immediately in production!)
  const bcryptHash = '$2b$10$defaulthashplaceholder'; // Replace with real bcrypt hash
  db.prepare('INSERT INTO admin_users (username, password) VALUES (?, ?)').run('admin', 'admin123');
}

// ===== MIDDLEWARE =====
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for frontend
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for contact form
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 submissions per 15 minutes
  message: { error: 'Too many submissions. Please try again in 15 minutes.' },
});

// Rate limiting for admin API
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: 'Too many requests. Please try again later.' },
});

// ===== SERVE FRONTEND =====
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// ===== API ROUTES =====

// POST /api/contact - Submit contact form
app.post('/api/contact', contactLimiter, (req, res) => {
  try {
    const { name, email, company, phone, message } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ error: 'Email is required' });
    }
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: 'Message is too long (max 5000 characters)' });
    }

    // Save to database
    const stmt = db.prepare(`
      INSERT INTO contacts (name, email, company, phone, message) 
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      name.trim(),
      email.trim(),
      company ? company.trim() : null,
      phone ? phone.trim() : null,
      message.trim()
    );

    console.log(`📩 New contact submission #${result.lastInsertRowid} from ${name} (${email})`);

    // Optional: Send email notification
    if (process.env.SMTP_HOST) {
      sendEmailNotification({ name, email, company, phone, message }).catch(err => {
        console.error('Email notification failed:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received. We will get back to you soon.',
      id: result.lastInsertRowid,
    });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Internal server error. Please try again later.' });
  }
});

// GET /api/contacts - List all contacts (admin)
app.get('/api/contacts', adminLimiter, (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM contacts';
    let countQuery = 'SELECT COUNT(*) as total FROM contacts';
    const params = [];
    const conditions = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR company LIKE ? OR message LIKE ?)');
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (conditions.length > 0) {
      const whereClause = ' WHERE ' + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

    const total = db.prepare(countQuery).get(...params).total;
    const contacts = db.prepare(query).all(...params, parseInt(limit), parseInt(offset));

    res.json({
      contacts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('List contacts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/contacts/:id - Get single contact
app.get('/api/contacts/:id', adminLimiter, (req, res) => {
  try {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(req.params.id);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(contact);
  } catch (err) {
    console.error('Get contact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/contacts/:id/status - Update contact status
app.put('/api/contacts/:id/status', adminLimiter, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'contacted', 'in-progress', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const result = db.prepare(`
      UPDATE contacts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ success: true, message: 'Status updated successfully' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/contacts/:id - Delete contact
app.delete('/api/contacts/:id', adminLimiter, (req, res) => {
  try {
    const result = db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true, message: 'Contact deleted successfully' });
  } catch (err) {
    console.error('Delete contact error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats - Dashboard stats
app.get('/api/stats', adminLimiter, (req, res) => {
  try {
    const total = db.prepare('SELECT COUNT(*) as count FROM contacts').get().count;
    const newCount = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE status = 'new'").get().count;
    const contactedCount = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE status = 'contacted'").get().count;
    const todayCount = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE DATE(created_at) = DATE('now')").get().count;
    const thisWeek = db.prepare("SELECT COUNT(*) as count FROM contacts WHERE created_at >= datetime('now', '-7 days')").get().count;

    res.json({
      total,
      new: newCount,
      contacted: contactedCount,
      today: todayCount,
      thisWeek,
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== EMAIL NOTIFICATION (Optional) =====
async function sendEmailNotification({ name, email, company, phone, message }) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@synergylearningacademy.com',
    to: process.env.NOTIFICATION_EMAIL || 'info@synergylearningacademy.com',
    subject: `New Contact Form Submission from ${name}`,
    html: `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; font-weight: bold;">Name:</td><td style="padding: 8px;">${name}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Email:</td><td style="padding: 8px;">${email}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${company || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Phone:</td><td style="padding: 8px;">${phone || 'N/A'}</td></tr>
        <tr><td style="padding: 8px; font-weight: bold;">Message:</td><td style="padding: 8px;">${message}</td></tr>
      </table>
    `,
  });
}

// ===== CATCH-ALL: Serve frontend for any other route =====
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   Synergy Learning Academy - Server Running      ║
  ║                                                  ║
  ║   🌐 Frontend:  http://localhost:${PORT}            ║
  ║   🔌 API:       http://localhost:${PORT}/api        ║
  ║   📊 Stats:     http://localhost:${PORT}/api/stats  ║
  ║                                                  ║
  ║   📩 Contact submissions saved to SQLite DB      ║
  ╚══════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  console.log('\n👋 Server shut down gracefully');
  process.exit(0);
});
