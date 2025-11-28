// Khởi tạo cho Alpine nếu sau này cần thêm store / magic
document.addEventListener('alpine:init', () => {
  // Ví dụ sau này bạn có thể thêm:
  // Alpine.store('admin', { sidebarOpen: true });
});

console.debug('Admin UI loaded');

// === Chart helpers ===

// Đảm bảo luôn có object chứa chart
window.__charts = window.__charts || {};

// Helper để đăng ký chart từ code React/JS khác
// Ví dụ khi khởi tạo chart: window.registerChart('revenueChart', chartInstance);
window.registerChart = function (key, instance) {
  window.__charts[key] = instance;
};

// Hàm resize tất cả chart an toàn
function resizeCharts() {
  if (!window.__charts) return;

  Object.values(window.__charts).forEach(ch => {
    if (ch && typeof ch.resize === 'function') {
      try {
        ch.resize();
      } catch (err) {
        console.warn('Chart resize error:', err);
      }
    }
  });
}

// Debounce resize để đỡ spam
let resizeTimer = null;

function handleResize() {
  if (resizeTimer) clearTimeout(resizeTimer);
  resizeTimer = setTimeout(resizeCharts, 150);
}

// Nếu cần reflow chart khi resize / đổi orientation (mobile)
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

// Gọi 1 lần khi load để đảm bảo chart fit layout ngay từ đầu
window.addEventListener('load', resizeCharts);
