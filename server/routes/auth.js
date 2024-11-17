// routes/auth.js
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');
const transporter = require('../config/nodemailer');

const { sendEmail } = require('../config/nodemailer');

// Registration route
router.post('/register', async (req, res) => {
    try {
        const { username, password, firstName, lastName, age, gender, email } = req.body;

        // Generate 2FA secret
        const secret = speakeasy.generateSecret({
            name: `YourApp:${username}`
        });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await User.create({
            username,
            password: hashedPassword,
            firstName,
            lastName,
            age,
            gender,
            email,
            twoFactorSecret: secret.base32,
            twoFactorEnabled: true
        });

        // Generate QR code
        const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

        // Send welcome email
        try {
            await sendEmail({
                to: email,
                subject: 'Welcome to Our App',
                html: `
          <h1>Welcome ${firstName}!</h1>
          <p>Thank you for registering. Please set up 2FA using the QR code provided during registration.</p>
        `
            });
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
            // Continue with registration even if email fails
        }

        res.render('register-success', { qrCodeUrl });
    } catch (error) {
        console.error('Registration failed:', error);
        res.status(500).json({
            message: 'Registration failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});


// Login route - Step 1: Username/Password
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await User.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Store user ID in session for 2FA step
        req.session.pendingUserId = user._id;

        res.render('2fa-verification');
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Login failed' });
    }
});

// Login route - Step 2: 2FA Verification
router.post('/verify-2fa', async (req, res) => {
    try {
        const { token } = req.body;
        const userId = req.session.pendingUserId;

        if (!userId) {
            return res.redirect('/login');
        }

        const user = await User.findById(userId);

        const isTokenValid = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token
        });

        if (!isTokenValid) {
            return res.status(401).json({ message: 'Invalid 2FA code' });
        }

        // Create JWT token
        const jwtToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1d' }
        );

        // Clear pending session
        delete req.session.pendingUserId;

        // Set HTTP-only cookie
        res.cookie('token', jwtToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 24 * 60 * 60 * 1000 // 1 day
        });

        res.redirect('/dashboard');
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Verification failed' });
    }
});



module.exports = router;
