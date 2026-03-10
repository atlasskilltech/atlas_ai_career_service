// Theme toggle
document.addEventListener('DOMContentLoaded', function () {
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;

  if (localStorage.getItem('theme') === 'dark') {
    html.classList.add('dark');
  }

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      html.classList.toggle('dark');
      localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  // Auto-dismiss flash messages
  setTimeout(function () {
    document.querySelectorAll('#flash-success, #flash-error').forEach(function (el) {
      el.style.transition = 'opacity 0.5s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 500);
    });
  }, 5000);
});

// Toast notification
function showToast(message, type) {
  var toast = document.createElement('div');
  toast.className = 'fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white flex items-center gap-2 ' +
    (type === 'success' ? 'bg-green-500' : 'bg-red-500');
  toast.innerHTML = '<i class="fas ' + (type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle') + '"></i>' +
    '<span>' + message + '</span>';
  document.body.appendChild(toast);
  setTimeout(function () {
    toast.style.transition = 'opacity 0.5s';
    toast.style.opacity = '0';
    setTimeout(function () { toast.remove(); }, 500);
  }, 3000);
}
