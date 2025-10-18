// Gắn vào trang login_register.ejs
(function () {
  const form = document.querySelector('#loginForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    // Nếu muốn submit AJAX:
    e.preventDefault();

    const fd = new FormData(form);
    const body = Object.fromEntries(fd.entries());

    const resp = await fetch('/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // báo hiệu AJAX
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });

    const j = await resp.json().catch(() => ({}));
    if (resp.ok && j?.ok && j?.redirect) {
      window.location.href = j.redirect;
      return;
    }

    // Hiển thị lỗi
    const err = j?.error || 'Email hoặc mật khẩu không đúng!';
    const el = document.querySelector('#loginError');
    if (el) {
      el.textContent = err;
      el.style.display = 'block'; 
    } else {
      alert(err);
    }
  });
})();
