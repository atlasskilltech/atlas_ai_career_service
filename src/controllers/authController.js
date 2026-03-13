const https = require('https');
const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');

class AuthController {
  getLogin(req, res) {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('pages/auth/login', { title: 'Login', layout: 'layouts/auth' });
  }

  getRegister(req, res) {
    if (req.session.user) return res.redirect('/dashboard');
    res.render('pages/auth/register', { title: 'Register', layout: 'layouts/auth' });
  }

  async postRegister(req, res) {
    try {
      const { name, email, password, confirmPassword, department, yearOfStudy } = req.body;
      if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match');
        return res.redirect('/auth/register');
      }

      // Check if user is active in dice_students before allowing registration
      const isActive = await userRepository.isUserActive(email, 'student');
      if (!isActive) {
        return res.render('pages/auth/access-denied', { title: 'Access Denied', layout: 'layouts/auth', userEmail: email });
      }

      await authService.register({ name, email, password, department, yearOfStudy });
      req.flash('success', 'Registration successful! Please check your email to verify your account.');
      res.redirect('/auth/login');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/auth/register');
    }
  }

  async postLogin(req, res) {
    try {
      const { email, password } = req.body;
      const user = await authService.login(email, password);

      // Check if user is active in dice_students/dice_staff
      const isActive = await userRepository.isUserActive(email, user.role);
      if (!isActive) {
        req.session.destroy();
        return res.render('pages/auth/access-denied', { title: 'Access Denied', layout: 'layouts/auth', userEmail: email });
      }

      req.session.user = user;
      req.flash('success', `Welcome back, ${user.name}!`);
      if (user.role === 'super_admin' || user.role === 'placement_admin') {
        return res.redirect('/admin');
      }
      res.redirect('/dashboard');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/auth/login');
    }
  }

  async verifyEmail(req, res) {
    try {
      await authService.verifyEmail(req.params.token);
      req.flash('success', 'Email verified successfully! You can now log in.');
    } catch (err) {
      req.flash('error', err.message);
    }
    res.redirect('/auth/login');
  }

  getForgotPassword(req, res) {
    res.render('pages/auth/forgot-password', { title: 'Forgot Password', layout: 'layouts/auth' });
  }

  async postForgotPassword(req, res) {
    try {
      await authService.forgotPassword(req.body.email);
      req.flash('success', 'Password reset link sent to your email');
    } catch (err) {
      req.flash('error', err.message);
    }
    res.redirect('/auth/forgot-password');
  }

  getResetPassword(req, res) {
    res.render('pages/auth/reset-password', {
      title: 'Reset Password',
      layout: 'layouts/auth',
      token: req.params.token,
    });
  }

  async postResetPassword(req, res) {
    try {
      const { password, confirmPassword } = req.body;
      if (password !== confirmPassword) {
        req.flash('error', 'Passwords do not match');
        return res.redirect(`/auth/reset-password/${req.params.token}`);
      }
      await authService.resetPassword(req.params.token, password);
      req.flash('success', 'Password reset successful! Please log in.');
      res.redirect('/auth/login');
    } catch (err) {
      req.flash('error', err.message);
      res.redirect('/auth/forgot-password');
    }
  }

  googleRedirect(req, res) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const baseUrl = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = baseUrl + '/auth/google/callback';
    const scope = encodeURIComponent('openid email profile');
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&prompt=select_account`;
    res.redirect(url);
  }

  async googleCallback(req, res) {
    try {
      const { code } = req.query;
      if (!code) {
        req.flash('error', 'Google sign-in was cancelled');
        return res.redirect('/auth/login');
      }

      // Exchange code for tokens
      const tokenData = await new Promise((resolve, reject) => {
        const postData = new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: (process.env.APP_URL || `${req.protocol}://${req.get('host')}`) + '/auth/google/callback',
          grant_type: 'authorization_code',
        }).toString();

        const reqOpts = {
          hostname: 'oauth2.googleapis.com',
          path: '/token',
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) },
        };

        const tokenReq = https.request(reqOpts, (tokenRes) => {
          let body = '';
          tokenRes.on('data', (chunk) => body += chunk);
          tokenRes.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Failed to parse token response')); }
          });
        });
        tokenReq.on('error', reject);
        tokenReq.write(postData);
        tokenReq.end();
      });

      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'Failed to get access token');
      }

      // Get user info
      const googleUser = await new Promise((resolve, reject) => {
        https.get(`https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokenData.access_token}`, (userRes) => {
          let body = '';
          userRes.on('data', (chunk) => body += chunk);
          userRes.on('end', () => {
            try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('Failed to parse user info')); }
          });
        }).on('error', reject);
      });

      if (!googleUser.email) {
        throw new Error('Could not get email from Google');
      }

      const user = await authService.googleLogin(googleUser);

      // Check if user is active in dice_students/dice_staff
      const isActive = await userRepository.isUserActive(user.email, user.role);
      if (!isActive) {
        return res.render('pages/auth/access-denied', { title: 'Access Denied', layout: 'layouts/auth', userEmail: user.email });
      }

      req.session.user = user;
      req.flash('success', `Welcome, ${user.name}!`);

      if (user.role === 'super_admin' || user.role === 'placement_admin') {
        return res.redirect('/admin');
      }
      res.redirect('/dashboard');
    } catch (err) {
      console.error('Google OAuth error:', err.message);
      req.flash('error', 'Google sign-in failed. Please try again.');
      res.redirect('/auth/login');
    }
  }

  logout(req, res) {
    req.session.destroy();
    res.redirect('/auth/login');
  }
}

module.exports = new AuthController();
