const r = require('express').Router();
const api = require('../lib/api');

// Home
r.get(['/', '/home'], async (req, res) => {
  const { data } = await api.get('/home', { headers: { cookie: req.headers.cookie || '' } });
  res.render('home', data);
});

// Category all
r.get('/category/alls', async (req, res) => {
  const { data } = await api.get('/category/alls', { params: req.query, headers: { cookie: req.headers.cookie || '' } });
  res.render('category', data);
});

// Category by id
r.get('/category/:id', async (req, res) => {
  const { data } = await api.get(`/category/${req.params.id}`, { params: req.query, headers: { cookie: req.headers.cookie || '' } });
  res.render('categogy_collections', data);
});

// Search
r.get('/search', async (req, res) => {
  const { data } = await api.get('/search', { params: req.query, headers: { cookie: req.headers.cookie || '' } });
  res.render('product_search', data);
});

// Product detail
r.get('/product_detail/:id', async (req, res) => {
  const { data } = await api.get(`/product_detail/${req.params.id}`, { headers: { cookie: req.headers.cookie || '' } });
  res.render('product_detail', data);
});

// Cart pages
r.get('/cart', async (req, res) => {
  const { data } = await api.get('/cart', { headers: { cookie: req.headers.cookie || '' } });
  res.render('cart', data);
});
r.get('/shop-cart', async (req, res) => {
  const { data } = await api.get('/cart', { headers: { cookie: req.headers.cookie || '' } });
  res.render('shop_cart', { title: 'Giỏ hàng', ...data });
});
r.get('/shop-cart/checkout', async (req, res) => {
  const { data } = await api.get('/shop-cart/checkout', { headers: { cookie: req.headers.cookie || '' } });
  res.render('shop_checkout', data);
});

// Auth pages
r.get('/login-register', async (req, res) => {
  const { data } = await api.get('/login-register', { headers: { cookie: req.headers.cookie || '' } });
  res.render('login_register', data);
});
r.get('/login', async (req, res) => {
  const { data } = await api.get('/login', { headers: { cookie: req.headers.cookie || '' } });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('login_register', data);
});
r.get('/register', async (req, res) => {
  const { data } = await api.get('/register', { headers: { cookie: req.headers.cookie || '' } });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('login_register', data);
});

// Account
r.get('/my-account', async (req, res) => {
  const { data } = await api.get('/my-account', { headers: { cookie: req.headers.cookie || '' } });
  if (data?.redirect) return res.redirect(data.redirect);
  return res.redirect('/account/profile');
});
r.get('/account/profile', async (req, res) => {
  const { data } = await api.get('/account/profile', { headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('account_profile', data);
});
r.get('/account/addresses', async (req, res) => {
  const { data } = await api.get('/account/addresses', { headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('account_addresses', data);
});
r.get('/account-orders', async (req, res) => {
  const { data } = await api.get('/account-orders', { headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('account_orders', data);
});
r.get('/orders/:id/details', async (req, res) => {
  const { data } = await api.get(`/orders/${req.params.id}/details`, { headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('order_detail', data);
});
r.get('/account/orders', async (req, res) => {
  const { data } = await api.get('/account/orders', { params: req.query, headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('account_orders', data);
});
r.get('/account/vouchers', async (req, res) => {
  const { data } = await api.get('/account/vouchers', { headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('account_vouchers', data);
});
r.get('/account/points', async (req, res) => {
  const { data } = await api.get('/account/points', { headers: { cookie: req.headers.cookie || '' }, validateStatus: () => true });
  if (data?.redirect) return res.redirect(data.redirect);
  res.render('account_points', data);
});

module.exports = r;
