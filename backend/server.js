require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const db = require('./database');
const ExcelHelper = require('./excelHelper');
const PaymentGateway = require('./paymentGateway');
const EmailService = require('./emailService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('../frontend'));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Initialize Excel file
ExcelHelper.initExcelFile();

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin middleware
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// ============= AUTHENTICATION =============
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Invalid username or password' });
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, role: user.role, username: user.username, full_name: user.full_name });
  });
});

app.post('/api/register', async (req, res) => {
  const { username, password, full_name, room_number, email, phone } = req.body;
  if (!username || !password || !full_name || !room_number || !email) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (username, password, full_name, room_number, email, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, hashedPassword, full_name, room_number, email, phone, 'user'],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
        return res.status(500).json({ error: 'Registration failed' });
      }
      EmailService.sendWelcomeEmail(email, full_name, username);
      res.json({ success: true, message: 'Registration successful!', user_id: this.lastID });
    }
  );
});

// ============= PAYMENTS =============
app.post('/api/create-payment', authenticateToken, async (req, res) => {
  try {
    const { month, year } = req.body;
    const userId = req.user.id;
    const amount = 500;

    db.get('SELECT * FROM payments WHERE user_id = ? AND month = ? AND year = ?',
      [userId, month, year], async (err, existing) => {
        if (existing) return res.status(400).json({ error: 'This month already paid' });

        const order = await PaymentGateway.createOrder(amount, `month_${month}_${year}`);
        db.run(
          'INSERT INTO payment_intents (user_id, month, year, amount, razorpay_order_id, status) VALUES (?, ?, ?, ?, ?, ?)',
          [userId, month, year, amount, order.id, 'created'],
          function(err) {
            if (err) return res.status(500).json({ error: 'Failed to create payment' });
            res.json({
              order_id: order.id,
              amount: order.amount,
              currency: order.currency,
              key_id: process.env.RAZORPAY_KEY_ID
            });
          }
        );
      });
  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ error: 'Payment initialization failed' });
  }
});

app.post('/api/verify-payment', authenticateToken, async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, month, year } = req.body;
    const isValid = PaymentGateway.verifyPayment(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) return res.status(400).json({ error: 'Invalid payment signature' });

    db.run(
      'UPDATE payment_intents SET status = ?, razorpay_payment_id = ? WHERE razorpay_order_id = ?',
      ['paid', razorpay_payment_id, razorpay_order_id],
      function(err) { if (err) console.error(err); }
    );

    db.run(
      'INSERT INTO payments (user_id, month, year, amount, status, payment_id) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, month, year, 500, 'paid', razorpay_payment_id],
      async function(err) {
        if (err) return res.status(500).json({ error: 'Failed to record payment' });

        db.get('SELECT email, full_name FROM users WHERE id = ?', [req.user.id], (err, user) => {
          if (user && user.email) {
            EmailService.sendPaymentConfirmation(user.email, user.full_name, month, year, 500);
          }
        });

        db.all('SELECT * FROM users', [], (err, users) => {
          db.all('SELECT * FROM payments', [], (err, payments) => {
            ExcelHelper.updateExcelFile(users, payments);
          });
        });

        res.json({ success: true, message: 'Payment successful', payment_id: this.lastID });
      }
    );
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

app.get('/api/payments/history', authenticateToken, (req, res) => {
  const query = req.user.role === 'admin'
    ? `SELECT p.*, u.username, u.full_name, u.room_number FROM payments p JOIN users u ON p.user_id = u.id ORDER BY p.payment_date DESC`
    : 'SELECT * FROM payments WHERE user_id = ? ORDER BY payment_date DESC';
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  db.all(query, params, (err, payments) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(payments);
  });
});

// ============= ADMIN =============
app.get('/api/students', authenticateToken, isAdmin, (req, res) => {
  db.all('SELECT id, username, full_name, room_number, email, phone, role, created_at FROM users', [], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

app.get('/api/dashboard-stats', authenticateToken, isAdmin, (req, res) => {
  db.get('SELECT COUNT(*) as total FROM users WHERE role = "user"', [], (err, totalUsers) => {
    db.get('SELECT COUNT(DISTINCT user_id) as paid FROM payments WHERE strftime("%Y", payment_date) = strftime("%Y", "now")', [], (err, paidUsers) => {
      db.get('SELECT SUM(amount) as total_collection FROM payments WHERE strftime("%Y", payment_date) = strftime("%Y", "now")', [], (err, totalCollection) => {
        const totalStudents = totalUsers?.total || 0;
        const paidCount = paidUsers?.paid || 0;
        const dueCount = totalStudents - paidCount;
        const collection = totalCollection?.total_collection || 0;
        const dueAmount = (totalStudents * 12 * 500) - collection;

        res.json({
          totalStudents,
          paidMembers: paidCount,
          dueMembers: dueCount,
          totalCollection: collection,
          dueAmount: dueAmount
        });
      });
    });
  });
});

app.post('/api/create-user', authenticateToken, isAdmin, (req, res) => {
  const { username, password, full_name, room_number, email, phone } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 10);
  db.run(
    'INSERT INTO users (username, password, full_name, room_number, email, phone, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [username, hashedPassword, full_name, room_number, email, phone, 'user'],
    function(err) {
      if (err) return res.status(500).json({ error: 'Username or email already exists' });
      EmailService.sendCredentials(email, full_name, username, password);
      res.json({ success: true, user_id: this.lastID });
    }
  );
});

app.get('/api/download-report', authenticateToken, isAdmin, (req, res) => {
  const filePath = ExcelHelper.getExcelFilePath();
  res.download(filePath, `hostel_fee_report_${new Date().toISOString().split('T')[0]}.xlsx`);
});

app.post('/api/send-reminders', authenticateToken, isAdmin, async (req, res) => {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    db.all(`
      SELECT u.* FROM users u
      WHERE u.role = 'user'
      AND u.id NOT IN (
        SELECT user_id FROM payments
        WHERE month = ? AND year = ?
      )
    `, [currentMonth, currentYear], async (err, dueStudents) => {
      if (err) return res.status(500).json({ error: 'Failed to fetch due students' });
      let sentCount = 0;
      for (const student of dueStudents) {
        if (student.email) {
          await EmailService.sendReminderEmail(student.email, student.full_name, currentMonth, currentYear, 500);
          sentCount++;
        }
      }
      res.json({ success: true, message: `Reminders sent to ${sentCount} students`, total_due: dueStudents.length, sent: sentCount });
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reminders' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});