const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// storing data in JSON files so it persists across server restarts
const DATA_DIR = path.join(__dirname, 'data');
const APPROVED_FILE = path.join(DATA_DIR, 'approved.json');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

// Initialize files if they don't exist
if (!fs.existsSync(APPROVED_FILE)) {
  fs.writeFileSync(APPROVED_FILE, JSON.stringify([]));
}
if (!fs.existsSync(PENDING_FILE)) {
  fs.writeFileSync(PENDING_FILE, JSON.stringify([]));
}

// Load data from files
let approvedEmails = new Set(JSON.parse(fs.readFileSync(APPROVED_FILE, 'utf8')));
let pendingRequests = new Set(JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8')));

// Helper functions to save data
function saveApproved() {
  fs.writeFileSync(APPROVED_FILE, JSON.stringify(Array.from(approvedEmails)));
}

function savePending() {
  fs.writeFileSync(PENDING_FILE, JSON.stringify(Array.from(pendingRequests)));
}

// config
require('dotenv').config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_APP_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const DOMAIN = process.env.DOMAIN || 'http://localhost:3000';

// validate required environment variables
if (!ADMIN_EMAIL || !EMAIL_USER || !EMAIL_APP_PASSWORD) {
  console.error('ERROR: Missing required environment variables!');
  console.error('Please create a .env file with:');
  console.error('  ADMIN_EMAIL=your-email@gmail.com');
  console.error('  EMAIL_USER=your-email@gmail.com');
  console.error('  EMAIL_APP_PASSWORD=your-app-password');
  process.exit(1);
}

// email setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_APP_PASSWORD
  }
});

// api endpoints

// Request approval for new email
app.post('/api/request-approval', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    // Check if already approved
    if (approvedEmails.has(email)) {
      return res.json({
        success: true,
        approved: true,
        message: 'Email already approved'
      });
    }

    // Check if already pending
    if (pendingRequests.has(email)) {
      return res.json({
        success: true,
        pending: true,
        message: 'Request already pending'
      });
    }

    // Add to pending requests
    pendingRequests.add(email);
    savePending(); // Save to file

    // Create approval link with token (for security)
    const approvalToken = Buffer.from(email).toString('base64');
    const approvalLink = `${DOMAIN}/api/approve?token=${approvalToken}`;
    const rejectLink = `${DOMAIN}/api/reject?token=${approvalToken}`;

    // Send email to admin
    const mailOptions = {
      from: EMAIL_USER,
      to: ADMIN_EMAIL,
      subject: '🐕 New Candy Certification Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f5f5f5;
              padding: 20px;
            }
            .container {
              background-color: white;
              max-width: 600px;
              margin: 0 auto;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h2 {
              color: #FFB6C1;
              margin-bottom: 20px;
            }
            .email-box {
              background-color: #fff5f7;
              padding: 15px;
              border-left: 4px solid #FF69B4;
              margin: 20px 0;
              font-size: 18px;
              font-weight: bold;
              color: #333;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              margin: 10px 10px 10px 0;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
              font-size: 16px;
            }
            .approve {
              background-color: #FF69B4;
              color: white;
            }
            .reject {
              background-color: #888;
              color: white;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eee;
              color: #666;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>🐕 New Candy Certification Request</h2>
            <p>Someone wants to join the Candy fan club!</p>
            
            <div class="email-box">
              ${email}
            </div>
            
            <p>Would you like to approve this email for Candy's gallery?</p>
            
            <a href="${approvalLink}" class="button approve">✓ Approve</a>
            <a href="${rejectLink}" class="button reject">✗ Reject</a>
            
            <div class="footer">
              <p>Request received at: ${new Date().toLocaleString()}</p>
              <p>This is an automated message from Candy's website.</p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      pending: true,
      message: 'Approval request sent to admin'
    });

  } catch (error) {
    console.error('Error sending approval request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send request'
    });
  }
});

// Check if email is approved
app.get('/api/check-email', (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({
      success: false,
      error: 'Email required'
    });
  }

  const approved = approvedEmails.has(email);
  const pending = pendingRequests.has(email);

  res.json({
    success: true,
    approved,
    pending
  });
});

// Approve email (admin clicks link)
app.get('/api/approve', async (req, res) => {
  try {
    const { token } = req.query;
    const email = Buffer.from(token, 'base64').toString('utf-8');

    // Move from pending to approved
    pendingRequests.delete(email);
    approvedEmails.add(email);

    // Save to files
    saveApproved();
    savePending();

    // Send confirmation email to user
    await transporter.sendMail({
      from: EMAIL_USER,
      to: email,
      subject: '🎉 You\'re Candy Certified!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f5f5f5;
              padding: 20px;
            }
            .container {
              background-color: white;
              max-width: 600px;
              margin: 0 auto;
              padding: 40px;
              border-radius: 10px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            h1 {
              color: #FF69B4;
              font-size: 32px;
              margin-bottom: 20px;
            }
            p {
              color: #333;
              font-size: 18px;
              line-height: 1.6;
            }
            .button {
              display: inline-block;
              margin-top: 30px;
              padding: 15px 40px;
              background-color: #FF69B4;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
              font-size: 18px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🎉 Congratulations!</h1>
            <p>You're now <strong>Candy Certified</strong>!</p>
            <p>You can now add your favorite pictures of Candy to the gallery.</p>
            <a href="${DOMAIN}" class="button">Visit Candy's Website</a>
          </div>
        </body>
        </html>
      `
    });

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #FFB6C1, #FF69B4);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .message {
            background: white;
            padding: 50px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
          h1 { color: #FF69B4; margin-bottom: 20px; }
          a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 30px;
            background: #FF69B4;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Email Approved!</h1>
          <p>${email} is now Candy Certified!</p>
          <p>A confirmation email has been sent.</p>
          <a href="${DOMAIN}">Back to Dashboard</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Error approving email:', error);
    res.status(500).send('Error approving email');
  }
});

// Reject email
app.get('/api/reject', (req, res) => {
  try {
    const { token } = req.query;
    const email = Buffer.from(token, 'base64').toString('utf-8');

    // Remove from pending
    pendingRequests.delete(email);
    savePending(); // Save to file

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            font-family: Arial, sans-serif;
            background: linear-gradient(135deg, #888, #666);
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
          }
          .message {
            background: white;
            padding: 50px;
            border-radius: 20px;
            text-align: center;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          }
          h1 { color: #666; margin-bottom: 20px; }
          a {
            display: inline-block;
            margin-top: 20px;
            padding: 12px 30px;
            background: #666;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="message">
          <h1>Request Rejected</h1>
          <p>${email} was not approved.</p>
          <a href="${DOMAIN}">Back to Dashboard</a>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Error rejecting email:', error);
    res.status(500).send('Error rejecting email');
  }
});

// Get all approved emails (admin only - add auth in production)
app.get('/api/admin/approved', (req, res) => {
  res.json({
    success: true,
    emails: Array.from(approvedEmails)
  });
});

// Get all pending requests (admin only - add auth in production)
app.get('/api/admin/pending', (req, res) => {
  res.json({
    success: true,
    emails: Array.from(pendingRequests)
  });
});

// start server
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║   🐕 Candy's Backend Server Running    ║
  ╠════════════════════════════════════════╣
  ║   Port: ${PORT}                        ║
  ║   Admin Email: ${ADMIN_EMAIL}          ║
  ╚════════════════════════════════════════╝
  
  Ready to receive Candy certification requests!
  `);
});