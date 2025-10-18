document.addEventListener('alpine:init',()=>{});
console.debug('Admin UI loaded');

// Nếu cần reflow chart khi sidebar toggle (mobile)
window.addEventListener('resize', () => {
  if (window.__charts) {
    Object.values(window.__charts).forEach(ch => ch.resize());
  }
});
