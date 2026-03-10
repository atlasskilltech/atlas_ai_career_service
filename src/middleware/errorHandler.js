function notFound(req, res) {
  res.status(404).render('pages/errors/404', {
    title: 'Page Not Found',
    layout: 'layouts/main',
  });
}

function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).render('pages/errors/500', {
    title: 'Server Error',
    layout: 'layouts/main',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
}

module.exports = { notFound, errorHandler };
