const authService = require('../services/authService');

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

  logout(req, res) {
    req.session.destroy();
    res.redirect('/auth/login');
  }
}

module.exports = new AuthController();
