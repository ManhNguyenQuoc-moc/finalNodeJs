const productService = require('../services/productService');
const categoryService = require('../services/categoryService');

exports.renderHome = (req, res) => {
  const categories = categoryService.getAllActiveCategories();
  const products = productService.getAllProducts(1, null, 0, 1000000).content;

  res.render('home', {
    title: 'Trang chủ',
    categories,
    products
  });
};
