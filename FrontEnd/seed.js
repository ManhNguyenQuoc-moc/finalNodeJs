// seed.js
require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const connectDB = require('./config/db');

// Models
const Brand        = require('./models/Brand');
const Cart         = require('./models/Cart');
const Category     = require('./models/Category');
const DiscountCode = require('./models/DiscountCode'); // code, usage_limit, usage_count
const Order        = require('./models/Order');
const Product      = require('./models/Product');
const ProductColor = require('./models/ProductColor');
const ProductSize  = require('./models/ProductSize');
const Review       = require('./models/Review');
const User         = require('./models/User');
const Wishlist     = require('./models/Wishlist');

/* ---------------- Helpers ---------------- */
const toSlug = (str='') =>
  String(str).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)+/g,'');

const hashPassword = (plain='password') => bcrypt.hash(plain, 10);

async function ensureSize(name){
  return ProductSize.findOneAndUpdate(
    { size_name: name }, { $setOnInsert: { size_name: name } }, { upsert:true, new:true }
  );
}
async function ensureColor(name, { color_code, imageUrls } = {}){
  const doc = { color_name: name };
  if (color_code) doc.color_code = color_code;
  // ProductColor không có imageUrls, nên bỏ qua
  return ProductColor.findOneAndUpdate(
    { color_name: name }, { $setOnInsert: doc }, { upsert:true, new:true }
  );
}

/* ---------------- Raw seed data ---------------- */
const categoriesSeed = [
  { name: 'Áo Thun',   imageUrl: '/mixishop/images/categories/ao-thun.jpg' },
  { name: 'Quần Jeans',imageUrl: '/mixishop/images/categories/quan-jeans.jpg' },
  { name: 'Áo Khoác',  imageUrl: '/mixishop/images/categories/ao-khoac.jpg' },
  { name: 'Phụ Kiện',  imageUrl: '/mixishop/images/categories/phu-kien.jpg' },
];

const brandsSeed = [{ name:'Mixi' }, { name:'DenimCo' }, { name:'OuterWear' }];

const usersSeed = [
  { full_name:'Test User', email:'test@example.com',  password:'password', roles:['customer'] },
  { full_name:'Admin',     email:'admin@example.com', password:'password', roles:['admin'] }
];

// Mỗi sản phẩm thuộc 1 category: dùng `categoryName`
const productsSeed = [
  {
    name:'Áo Thun Đen',
    brandName:'Mixi',
    categoryName:'Áo Thun',
    price:100000,
    shortDesc:'Áo thun cotton thoáng mát, phom regular.',
    longDesc:'Áo thun cotton thoáng mát.\nPhom regular.\nBo cổ bền.\nIn bền màu.\nPhối đồ đa dụng.',
    sizes:['S','M','L'],
    colors:[
      { color:'Red',   imageUrls:['/mixishop/images/products/ao2023.png','/mixishop/images/products/ao2024.png'] },
      { color:'Black', imageUrls:['/mixishop/images/products/ao3loMixi.png','/mixishop/images/products/ao20242.png'] },
    ],
    // tồn kho tham khảo theo màu/size (ta sẽ cộng dồn theo size vì variant chỉ theo size)
    stock:{ Red:{S:10,M:5,L:0}, Black:{S:8,M:3,L:2} }
  },
  {
    name:'Quần Jeans',
    brandName:'DenimCo',
    categoryName:'Quần Jeans',
    price:200000,
    shortDesc:'Jeans nam co giãn nhẹ, form vừa.',
    longDesc:'Jeans nam co giãn nhẹ.\nForm vừa vặn.\nBạc màu nhẹ.\nKhóa kéo kim loại.\nỐng đứng dễ mặc.',
    sizes:['M','L','XL'],
    colors:[
      { color:'Blue',  imageUrls:['/mixishop/images/products/jean1.png','/mixishop/images/products/jean2.png'] },
      { color:'Black', imageUrls:['/mixishop/images/products/jean3.png','/mixishop/images/products/jean4.png'] },
    ],
    stock:{ Blue:{M:15,L:7,XL:4}, Black:{M:6,L:2,XL:0} }
  },
  {
    name:'Áo Khoác',
    brandName:'OuterWear',
    categoryName:'Áo Khoác',
    price:300000,
    shortDesc:'Áo khoác ấm, cản gió.',
    longDesc:'Áo khoác ấm, cản gió.\nVải dệt dày.\nKhóa kéo trơn mượt.\nNhiều túi tiện lợi.',
    sizes:['S','M'],
    colors:[
      { color:'Green', imageUrls:['/mixishop/images/products/khoac1.png','/mixishop/images/products/khoac2.png'] },
      { color:'Black', imageUrls:['/mixishop/images/products/khoac3.png','/mixishop/images/products/khoac4.png'] },
    ],
    stock:{ Green:{S:12,M:8}, Black:{S:4,M:3} }
  },
];

// DiscountCode schema chỉ có: code, usage_limit, usage_count
const discountSeed = [
  { code:'SALE10', usage_limit:10, usage_count:0 },
  { code:'FREESHIP', usage_limit:10, usage_count:0 }
];

const reviewsSeed = [
  { productName:'Áo Thun Đen',  guest_name:'Khách 1', rating:5, comment:'Áo đẹp, mặc mát!' },
  { productName:'Áo Thun Đen',  guest_name:'Khách 2', rating:4, comment:'Chất vải ổn, đáng tiền.' },
];

/* ---------------- Main ---------------- */
async function run(){
  await connectDB();

  // Clear
  await Promise.all([
    Brand.deleteMany({}),
    Cart.deleteMany({}),
    Category.deleteMany({}),
    DiscountCode.deleteMany({}),
    Order.deleteMany({}),
    Product.deleteMany({}),
    ProductColor.deleteMany({}),
    ProductSize.deleteMany({}),
    Review.deleteMany({}),
    User.deleteMany({}),
    Wishlist.deleteMany({}),
  ]);

  // Users
  const userDocs = [];
  for (const u of usersSeed){
    const doc = {
      full_name: u.full_name,
      email: u.email,
      roles: u.roles || ['customer'],
      password_hash: await hashPassword(u.password)
    };
    userDocs.push(await User.create(doc));
  }
  const testUser = userDocs.find(u => u.email === 'test@example.com');

  // Categories
  const catDocs = [];
  for (const c of categoriesSeed){
    catDocs.push(await Category.create({
      name: c.name,
      slug: toSlug(c.name),
      imageUrl: c.imageUrl,
      status: 1
    }));
  }

  // Brands
  const brandDocs = [];
  for (const b of brandsSeed){
    brandDocs.push(await Brand.create({ name:b.name, slug:toSlug(b.name) }));
  }

  // Products (category_id đơn; colors trên product; variants chỉ theo size)
  const createdProducts = [];
  for (const p of productsSeed){
    const brand = brandDocs.find(b => b.name === p.brandName);
    const category = catDocs.find(c => c.name === p.categoryName);

    // Ảnh đại diện: lấy từ color đầu
    const firstColorImgs = p.colors?.[0]?.imageUrls || [];
    const images = firstColorImgs.map((url, i) => ({ url, is_primary: i===0 }));

    // Tạo product “rỗng” trước (để có _id)
    const product = await Product.create({
      name: p.name,
      slug: toSlug(p.name),
      short_description: p.shortDesc || '',
      long_description: p.longDesc || '',
      brand_id: brand?._id,
      category_id: category?._id,      // 👈 chỉ 1 category
      images,
      price: p.price,
      status: 'active'
    });

    // ensure sizes & colors
    const sizeDocs  = await Promise.all((p.sizes || []).map(s => ensureSize(s)));
    const colorDocs = await Promise.all((p.colors || []).map(c => ensureColor(c.color)));

    // colors (lưu ở product, không nằm trong variant)
    const productColors = (p.colors || []).map((c, idx) => {
      const cd = colorDocs[idx];
      return {
        color_id: cd._id,
        imageUrls: c.imageUrls || [],
        is_primary: idx === 0
      };
    });

    // variants THEO SIZE (không có color_id)
    const variants = sizeDocs.map(s => {
      const sizeName = s.size_name;
      // cộng dồn stock của mọi màu cho size này
      let stockSum = 0;
      if (p.stock) {
        for (const colorName in p.stock) {
          stockSum += Number(p.stock[colorName]?.[sizeName] || 0);
        }
      }
      return {
        sku: `${toSlug(p.name)}-${toSlug(sizeName)}`,
        size_id: s._id,
        price: p.price,               // có thể tùy biến theo size nếu muốn
        stock_quantity: stockSum || 10
      };
    });

    await Product.updateOne({ _id: product._id }, { $set: { colors: productColors, variants } });

    createdProducts.push({ product, sizeDocs, variants });
  }

  // Reviews cho sản phẩm đầu
  if (createdProducts[0]) {
    const p0 = createdProducts[0].product;
    const list = reviewsSeed.map(r => ({
      product_id: p0._id,
      rating: r.rating,
      comment: r.comment,
      guest_name: r.guest_name,
      guest_email: 'guest@example.com',
      user_id: testUser?._id || null
    }));
    if (list.length) await Review.insertMany(list);
  }

  // Wishlist mẫu
  if (Wishlist) {
    await Wishlist.create({
      user_id: testUser._id,
      product_ids: createdProducts.slice(0,2).map(x => x.product._id)
    });
  }

  // Cart mẫu (chọn theo SIZE → sku)
  const cartItems = [];
  {
    const wrap = createdProducts[0]; // Áo thun
    const sizeM = wrap.sizeDocs.find(s => s.size_name === 'M');
    const variant = wrap.variants.find(v => String(v.size_id) === String(sizeM._id));
    cartItems.push({
      product_id: wrap.product._id,
      variant_sku: variant.sku,
      name_snapshot: wrap.product.name,
      price_at_time: variant.price,
      quantity: 2
    });
  }
  {
    const wrap = createdProducts[1]; // Jeans
    const sizeL = wrap.sizeDocs.find(s => s.size_name === 'L');
    const variant = wrap.variants.find(v => String(v.size_id) === String(sizeL._id));
    cartItems.push({
      product_id: wrap.product._id,
      variant_sku: variant.sku,
      name_snapshot: wrap.product.name,
      price_at_time: variant.price,
      quantity: 1
    });
  }
  await Cart.create({ user_id: testUser._id, items: cartItems });

  // Discount codes (đúng schema)
  if (discountSeed.length) await DiscountCode.insertMany(discountSeed);

  // Order mẫu (snapshot từ cart)
  const order_items = cartItems.map(ci => ({
    product_id: ci.product_id,
    name_snapshot: ci.name_snapshot,
    variant_sku: ci.variant_sku,
    unit_price: ci.price_at_time,
    quantity: ci.quantity
  }));
  const total_amount = order_items.reduce((s,it)=>s+(it.unit_price*it.quantity),0);
  await Order.create({
    user_id: testUser._id,
    order_items,
    total_amount,
    status: 'pending',
    status_history: [{ status: 'pending', timestamp: new Date() }]
  });

  console.log('🎉 Seed dữ liệu HOÀN TẤT!');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch(err=>{
  console.error('❌ Lỗi seed:', err);
  mongoose.connection.close().finally(()=>process.exit(1));
});
