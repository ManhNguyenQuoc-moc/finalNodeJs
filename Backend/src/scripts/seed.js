// backend/scripts/seed.js
require('dotenv').config();
const mongoose = require('mongoose');

const Brand         = require('../models/Brand');
const Category      = require('../models/Category');
const Product       = require('../models/Product');
const ProductColor  = require('../models/ProductColor');
const ProductSize   = require('../models/ProductSize');
const ProductVariant= require('../models/ProductVariant');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shopdb';

async function main() {
  await mongoose.connect(MONGODB_URI, {});

  // Xoá dữ liệu cũ (tuỳ ý)
  await Promise.all([
    Brand.deleteMany({}),
    Category.deleteMany({}),
    Product.deleteMany({}),
    ProductColor.deleteMany({}),
    ProductSize.deleteMany({}),
    ProductVariant.deleteMany({}),
  ]);

  // 1) Brand & Category
  const brand = await Brand.create({ name: 'MixiWear', slug: 'mixiwear' });
  const cat   = await Category.create({ name: 'Áo thun', slug: 'ao-thun', description: 'Áo thun basic' });

  // 2) Product
  const product = await Product.create({
    name: 'Áo thun basic nhiều màu',
    slug: 'ao-thun-basic-nhieu-mau',
    brand: brand._id,
    category: cat._id,
    short_description: 'Áo thun cotton 2 chiều, form regular.',
    long_description: 'Chất cotton thoáng mát.\nCo giãn tốt.\nNhiều màu, đủ size.',
    productStatus: { statusName: 'Trending' }
    // Lưu ý: model Product của bạn không có field images → ảnh đặt ở variant
  });

  // 3) Colors (mỗi màu có nhiều ảnh)
  const colors = await ProductColor.insertMany([
    { product: product._id, color_name: 'Đen',   color_code: '#000000' },
    { product: product._id, color_name: 'Trắng', color_code: '#FFFFFF' },
  ]);

  // 4) Sizes
  const sizes = await ProductSize.insertMany([
    { product: product._id, size_name: 'S', size_order: 1 },
    { product: product._id, size_name: 'M', size_order: 2 },
    { product: product._id, size_name: 'L', size_order: 3 },
  ]);

  // 5) Helper tạo ảnh theo màu
  const makeColorImages = (sku, colorKey) => {
    // colorKey: 'black' | 'white' v.v… → ảnh khác nhau cho dễ test
    return [
      { url: `https://picsum.photos/seed/${colorKey}-${sku}-1/900`, public_id: `${colorKey}-${sku}-1`, is_primary: true  },
      { url: `https://picsum.photos/seed/${colorKey}-${sku}-2/900`, public_id: `${colorKey}-${sku}-2`, is_primary: false },
      { url: `https://picsum.photos/seed/${colorKey}-${sku}-3/900`, public_id: `${colorKey}-${sku}-3`, is_primary: false },
    ];
  };

  const colorKey = (name) => name.toLowerCase().includes('đen') ? 'black' : 'white';

  // 6) Tạo Variants = mọi tổ hợp {color × size}
  const variantsToCreate = [];
  for (const c of colors) {
    for (const s of sizes) {
      const sku = `TSHIRT-${c.color_name.toUpperCase()}-${s.size_name}`;
      variantsToCreate.push({
        product: product._id,
        color: c._id,
        size: s._id,
        sku,
        price: 199000,
        stock_quantity: 50,
        images: makeColorImages(sku, colorKey(c.color_name)),
      });
    }
  }

  await ProductVariant.insertMany(variantsToCreate);

  console.log(' Seed xong!');
  console.log('Product ID:', product._id.toString());
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
