const jwt = require('jsonwebtoken');

function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    res.locals.user = req.session.user;
    return next();
  }
  req.flash('error', 'Please log in to continue');
  return res.redirect('/auth/login');
}

function isRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash('error', 'Please log in to continue');
      return res.redirect('/auth/login');
    }
    if (!roles.includes(req.session.user.role)) {
      req.flash('error', 'You do not have permission to access this resource');
      return res.redirect('/dashboard');
    }
    next();
  };
}

function isAdmin(req, res, next) {
  return isRole('placement_admin', 'super_admin')(req, res, next);
}

function isSuperAdmin(req, res, next) {
  return isRole('super_admin')(req, res, next);
}

function apiAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.session?.user?.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { isAuthenticated, isRole, isAdmin, isSuperAdmin, apiAuth };
