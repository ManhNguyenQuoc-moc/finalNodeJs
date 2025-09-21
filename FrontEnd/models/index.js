// models/index.js
const Brand         = require('./Brand');
const Cart          = require('./Cart');
const Category      = require('./Category');
const DiscountCode  = require('./DiscountCode');
const Order         = require('./Order');
const Product       = require('./Product');
const ProductColor  = require('./ProductColor');
const ProductSize   = require('./ProductSize');
const Review        = require('./Review');
const User          = require('./User');
const Wishlist      = require('./Wishlist');

module.exports = {
  Brand,
  Cart,
  Category,
  DiscountCode,
  Order,
  Product,
  ProductColor,
  ProductSize,
  Review,
  User,
  Wishlist
};
