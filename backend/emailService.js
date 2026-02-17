const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }

  async sendWelcomeEmail(toEmail, name, username) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Welcome to Hostel Fee Management System',
      html: `
        <div style="font-family: Arial, sans-serif;">
          <h2 style="color: #667eea;">Welcome to Hostel Fee Management System! 🏠</h2>
          <p>Dear ${name},</p>
          <p>Your account has been created successfully. You can now login to pay your hostel fees online.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h3>Your Login Credentials:</h3>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Login URL:</strong> <a href="${process.env.BASE_URL}">${process.env.BASE_URL}</a></p>
          </div>
          <p>Monthly Hostel Fee: ₹500</p>
          <p>You can pay online using Credit Card, Debit Card, UPI, or NetBanking.</p>
        </div>
      `
    };
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Email sending failed:', error);
    }
  }

  async sendPaymentConfirmation(toEmail, name, month, year, amount) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Payment Confirmation - Hostel Fee',
      html: `
        <div>
          <h2 style="color: #28a745;">Payment Successful! ✅</h2>
          <p>Dear ${name},</p>
          <p>Your hostel fee payment has been received successfully.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h3>Payment Details:</h3>
            <table>
              <tr><td><strong>Month:</strong></td><td>${months[month-1]} ${year}</td></tr>
              <tr><td><strong>Amount:</strong></td><td>₹${amount}</td></tr>
              <tr><td><strong>Payment Date:</strong></td><td>${new Date().toLocaleString()}</td></tr>
            </table>
          </div>
          <p>Thank you for using our online payment system.</p>
        </div>
      `
    };
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Payment confirmation email failed:', error);
    }
  }

  async sendReminderEmail(toEmail, name, month, year, amount) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Reminder: Hostel Fee Payment Due',
      html: `
        <div>
          <h2 style="color: #dc3545;">Fee Payment Reminder ⏰</h2>
          <p>Dear ${name},</p>
          <p>This is a reminder that your hostel fee for <strong>${months[month-1]} ${year}</strong> is due.</p>
          <div style="background: #fff3cd; padding: 20px; border-radius: 10px; border: 1px solid #ffc107;">
            <h3 style="color: #856404;">Due Amount: ₹${amount}</h3>
            <p>Please pay your fee as soon as possible.</p>
            <a href="${process.env.BASE_URL}" style="background: #667eea; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Pay Now</a>
          </div>
        </div>
      `
    };
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Reminder email failed:', error);
    }
  }

  async sendCredentials(toEmail, name, username, password) {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: toEmail,
      subject: 'Your Hostel Fee System Login Credentials',
      html: `
        <div>
          <h2 style="color: #667eea;">Account Created Successfully</h2>
          <p>Dear ${name},</p>
          <p>Your account has been created.</p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px;">
            <h3>Login Credentials:</h3>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Login URL:</strong> <a href="${process.env.BASE_URL}">${process.env.BASE_URL}</a></p>
          </div>
          <p style="color: #dc3545;">Please change your password after first login.</p>
        </div>
      `
    };
    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Credentials email failed:', error);
    }
  }
}

module.exports = new EmailService();