// config/nodemailer.js
const nodemailer = require('nodemailer');

// Create test account for development
const createTestAccount = async () => {
    try {
        // Generate test SMTP service account from ethereal.email
        const testAccount = await nodemailer.createTestAccount();

        return nodemailer.createTransport({
            host: testAccount.smtp.host,
            port: testAccount.smtp.port,
            secure: testAccount.smtp.secure,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass
            }
        });
    } catch (error) {
        console.error('Failed to create test account:', error);
        return null;
    }
};

// Create transport based on environment
const createTransport = () => {
    if (process.env.NODE_ENV === 'development') {
        return createTestAccount();
    }

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === '465',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
};

// Modified email sending function
const sendEmail = async ({ to, subject, html }) => {
    try {
        const transporter = await createTransport();
        if (!transporter) {
            throw new Error('Email transport not configured');
        }

        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || '"Your App" <noreply@yourapp.com>',
            to,
            subject,
            html
        });

        if (process.env.NODE_ENV === 'development') {
            // Log preview URL in development
            console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
        }

        return info;
    } catch (error) {
        console.error('Failed to send email:', error);
        throw error;
    }
};

module.exports = { sendEmail };