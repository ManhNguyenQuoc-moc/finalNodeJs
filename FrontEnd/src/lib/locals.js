const api = require('./api');

module.exports = async function locals(req, res, next) {
  try {
    const { data } = await api.get('/api/layout-data', { headers: { cookie: req.headers.cookie || '' } });
    res.locals.carts = data.carts || [];
    res.locals.cartCount = data.cartCount || 0;
    res.locals.total = data.total || 0;
    res.locals.formattedTotal = data.formattedTotal || '0 đ';
  } catch (e) {
    res.locals.carts = [];
    res.locals.cartCount = 0;
    res.locals.total = 0;
    res.locals.formattedTotal = '0 đ';
  }

  res.locals.formatPrice = (v) => {
    const n = Number(v) || 0;
    return n.toLocaleString('vi-VN') + ' đ';
  };
  res.locals.sort        = req.query.sort || null;
  res.locals.color       = req.query.color || null;
  res.locals.price_range = req.query.price_range || '';
  res.locals.brand       = req.query.brand || '';
  res.locals.rating      = req.query.rating || '';
  res.locals.q           = req.query.q || '';

  next();
};
