const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { sendMail } = require('../config/email');
const { generateToken } = require('../utils/helpers');

class AuthService {
  async register(data) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new Error('Email already registered');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const verificationToken = generateToken();

    const user = await userRepository.create({
      ...data,
      password: hashedPassword,
      verificationToken,
    });

    try {
      await sendMail({
        to: data.email,
        subject: 'Verify Your Email - Atlas Career Platform',
        html: `
          <h2>Welcome to Atlas Career Platform!</h2>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${process.env.APP_URL}/auth/verify/${verificationToken}" style="background:#0a1a4a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Verify Email</a>
          <p>If you didn't create this account, please ignore this email.</p>
        `,
      });
    } catch {
      // Email sending may fail in development
    }

    return user;
  }

  async login(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('Invalid email or password');

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new Error('Invalid email or password');

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatar: user.avatar,
      token,
    };
  }

  async verifyEmail(token) {
    const user = await userRepository.verifyEmail(token);
    if (!user) throw new Error('Invalid or expired verification token');
    return user;
  }

  async forgotPassword(email) {
    const user = await userRepository.findByEmail(email);
    if (!user) throw new Error('No account found with this email');

    const resetToken = generateToken();
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await userRepository.setResetToken(email, resetToken, expires);

    try {
      await sendMail({
        to: email,
        subject: 'Reset Password - Atlas Career Platform',
        html: `
          <h2>Password Reset</h2>
          <p>Click the link below to reset your password:</p>
          <a href="${process.env.APP_URL}/auth/reset-password/${resetToken}" style="background:#0a1a4a;color:white;padding:12px 24px;text-decoration:none;border-radius:8px;display:inline-block;">Reset Password</a>
          <p>This link expires in 1 hour.</p>
        `,
      });
    } catch {
      // Email sending may fail in development
    }

    return resetToken;
  }

  async resetPassword(token, newPassword) {
    const user = await userRepository.findByResetToken(token);
    if (!user) throw new Error('Invalid or expired reset token');

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await userRepository.resetPassword(user.id, hashedPassword);
    return user;
  }

  async updateProfile(userId, data) {
    await userRepository.update(userId, data);
    return userRepository.findById(userId);
  }
}

module.exports = new AuthService();
