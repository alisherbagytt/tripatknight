const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { sendEmail } = require('../config/nodemailer');

const adminLayout = '../views/layouts/admin';
const jwtSecret = process.env.JWT_SECRET;

/**
 * Authentication Middleware
 */
const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;

  if(!token) {
    return res.redirect('/login');
  }

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch(error) {
    res.redirect('/login');
  }
};

/**
 * Role-based Authorization Middleware
 */
const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return res.status(403).render('error', {
        message: 'Access denied. Insufficient permissions.',
        layout: adminLayout
      });
    }
    next();
  };
};

/**
 * GET /register
 * Registration Page
 */
router.get('/register', async (req, res) => {
  try {
    const locals = {
      title: "Register",
      description: "Create a new account"
    }

    res.render('admin/register', {
      locals,
      layout: adminLayout,
      messages: req.flash()
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error loading registration page');
  }
});

/**
 * POST /register
 * Process Registration
 */
router.post('/register', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName, age, gender } = req.body;

    // Generate 2FA secret
    const secret = speakeasy.generateSecret({
      name: `YourApp:${username}`
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user with default role 'user'
    const user = await User.create({
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      age,
      gender,
      role: 'user',
      twoFactorSecret: secret.base32,
      twoFactorEnabled: true
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Send welcome email
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to Our Blog',
        html: `
          <h1>Welcome ${firstName}!</h1>
          <p>Thank you for registering. Please set up 2FA using the QR code shown on the registration success page.</p>
        `
      });
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Render registration success page with QR code
    res.render('admin/register-success', {
      locals: {
        title: 'Registration Success',
        description: 'Complete your 2FA setup'
      },
      qrCodeUrl,
      layout: adminLayout
    });

  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key error
      res.render('admin/register', {
        locals: {
          title: 'Register',
          description: 'Create a new account'
        },
        error: 'Username or email already in use',
        layout: adminLayout
      });
    } else {
      console.log(error);
      res.status(500).send('Error during registration');
    }
  }
});

/**
 * GET /login
 * Login Page
 */
router.get('/login', async (req, res) => {
  try {
    const locals = {
      title: "Login",
      description: "Login to your account"
    }

    res.render('admin/login', {
      locals,
      layout: adminLayout,
      messages: req.flash()
    });
  } catch (error) {
    console.log(error);
  }
});

/**
 * POST /login
 * Process Login - Step 1: Username/Password
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if(!user) {
      return res.render('admin/login', {
        locals: {
          title: 'Login',
          description: 'Login to your account'
        },
        error: 'Invalid credentials',
        layout: adminLayout
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if(!isPasswordValid) {
      return res.render('admin/login', {
        locals: {
          title: 'Login',
          description: 'Login to your account'
        },
        error: 'Invalid credentials',
        layout: adminLayout
      });
    }

    // Store user ID in session for 2FA step
    req.session.pendingUserId = user._id;

    // Redirect to 2FA verification page
    res.render('admin/2fa-verification', {
      locals: {
        title: '2FA Verification',
        description: 'Enter your 2FA code'
      },
      layout: adminLayout
    });

  } catch (error) {
    console.log(error);
    res.status(500).send('Error during login');
  }
});

/**
 * POST /verify-2fa
 * Process Login - Step 2: 2FA Verification
 */
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
      token: token,
      window: 1 // Allow 30 seconds window
    });

    if (!isTokenValid) {
      return res.render('admin/2fa-verification', {
        locals: {
          title: '2FA Verification',
          description: 'Enter your 2FA code'
        },
        error: 'Invalid 2FA code',
        layout: adminLayout
      });
    }

    // Create JWT token with role
    const jwtToken = jwt.sign(
        {
          userId: user._id,
          role: user.role
        },
        jwtSecret,
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
    console.log(error);
    res.status(500).send('Error during 2FA verification');
  }
});

/**
 * GET /dashboard
 * Admin Dashboard - Accessible by all authenticated users
 */
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const locals = {
      title: 'Dashboard',
      description: 'View and manage blog posts'
    }

    const data = await Post.find();
    res.render('admin/dashboard', {
      locals,
      data,
      userRole: req.userRole,
      layout: adminLayout
    });

  } catch (error) {
    console.log(error);
  }
});

router.get('/add-post', authMiddleware, roleCheck(['admin', 'editor']), async (req, res) => {
  try {
    const locals = {
      title: 'Add New Post',
      description: 'Create a new blog post'
    }

    res.render('admin/add-post', {
      locals,
      layout: adminLayout
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Error loading add post page');
  }
});


/**
 * POST /add-post
 * Create New Post - Accessible by admin and editor
 */

router.post('/add-post', async (req, res) => {
  try {
    const { title, body, images } = req.body;

    // Ensure there are at least 3 valid image URLs
    if (!images || images.length < 3) {
      return res.status(400).send('A post must have at least 3 images.');
    }

    const post = new Post({
      title,
      body,
      images
    });

    await post.save();
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error adding post:', error);
    res.status(500).send('Server error');
  }
});

router.get('/edit-post/:id', authMiddleware, roleCheck(['admin', 'editor']), async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).render('error', {
        message: 'Post not found',
        layout: adminLayout
      });
    }

    // Pass post data to the view
    res.render('admin/edit-post', {
      data: post, // Key is 'data' to match your EJS code
      layout: adminLayout
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error loading edit post page');
  }
});



/**
 * PUT /edit-post/:id
 * Edit Post - Accessible by admin and editor
 */
router.put('/edit-post/:id', async (req, res) => {
  try {
    const { title, body, images } = req.body;

    // Ensure there are at least 3 valid image URLs
    if (!images || images.length < 3) {
      return res.status(400).send('A post must have at least 3 images.');
    }

    await Post.findByIdAndUpdate(req.params.id, {
      title,
      body,
      images,
      updatedAt: Date.now()
    });

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Error editing post:', error);
    res.status(500).send('Server error');
  }
});


/**
 * DELETE /delete-post/:id
 * Delete Post - Accessible only by admin
 */
router.delete('/delete-post/:id', authMiddleware, roleCheck(['admin']), async (req, res) => {
  try {
    await Post.deleteOne({ _id: req.params.id });
    res.redirect('/dashboard');
  } catch (error) {
    console.log(error);
  }
});

/**
 * GET /logout
 * Logout
 */
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  req.session.destroy();
  res.redirect('/');
});



module.exports = router;