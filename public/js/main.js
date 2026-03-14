// Theme toggle
document.addEventListener('DOMContentLoaded', function () {
  var themeToggle = document.getElementById('theme-toggle');
  var html = document.documentElement;

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
      el.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(function () { el.remove(); }, 400);
    });
  }, 5000);
});

// Toast notification
function showToast(message, type) {
  var existing = document.querySelectorAll('.toast-notification');
  var offset = 16 + (existing.length * 60);

  var toast = document.createElement('div');
  toast.className = 'toast-notification fixed right-4 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium';
  toast.style.cssText = 'top:' + offset + 'px;backdrop-filter:blur(12px);transform:translateX(120%);transition:all 0.4s cubic-bezier(0.4,0,0.2,1);' +
    (type === 'success' ? 'background:linear-gradient(135deg,#16a34a,#15803d)' : 'background:linear-gradient(135deg,#dc2626,#b91c1c)');

  var iconClass = type === 'success' ? 'fa-check' : 'fa-exclamation';
  toast.innerHTML = '<div style="width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="fas ' + iconClass + '" style="font-size:11px"></i></div>' +
    '<span>' + message + '</span>';

  document.body.appendChild(toast);

  // Slide in
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      toast.style.transform = 'translateX(0)';
    });
  });

  // Auto dismiss
  setTimeout(function () {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(function () { toast.remove(); }, 400);
  }, 3500);
}
