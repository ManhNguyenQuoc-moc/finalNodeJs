// server.js — Admin EJS (gọn, UI đẹp, mock CRUD, có đổi mật khẩu/đăng xuất, KHÔNG quản lý giỏ hàng)
const express = require('express');
const path = require('path');
const engine = require('ejs-mate');

const app = express();

/* ---------------- View & static ---------------- */
app.engine('ejs', engine);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use(express.urlencoded({ extended: true }));

/* ---------------- Helpers (locals) ---------------- */
let ADMIN_ACCOUNT = { id: 'admin1', full_name: 'Admin', password: 'admin123' }; // demo
app.use((req, res, next) => {
  res.locals.money = (v) => {
    try { return (v || 0).toLocaleString('vi-VN', { style:'currency', currency:'VND' }); }
    catch { return v; }
  };
  res.locals.admin = { full_name: ADMIN_ACCOUNT.full_name };
  res.locals.activePath = req.path;
  res.locals.flash = {};
  next();
});
// Flash đơn giản qua query (?s=... / ?e=...)
app.use((req, res, next) => {
  if (req.query && req.query.s) res.locals.flash.success = req.query.s;
  if (req.query && req.query.e) res.locals.flash.error   = req.query.e;
  next();
});

/* ---------------- Utils ---------------- */
function paginate(array, page = 1, pageSize = 10) {
  const totalItems = array.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const current = Math.min(Math.max(1, parseInt(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  const end = start + pageSize;
  return { items: array.slice(start, end), page: current, totalPages, totalItems };
}
function baseUrl(req) {
  const q = new URLSearchParams(req.query);
  q.delete('page');
  return req.path + (q.toString() ? `?${q.toString()}&page=` : '?page=');
}

/* ---------------- Mock data (bám model bạn gửi) ---------------- */
let BRANDS = [
  {_id:'b1',name:'A Brand',slug:'a-brand',createdAt:new Date()},
  {_id:'b2',name:'B Brand',slug:'b-brand',createdAt:new Date()}
];
let CATEGORIES = [
  {_id:'c1',name:'Áo',slug:'ao',description:'Áo thời trang',createdAt:new Date()},
  {_id:'c2',name:'Quần',slug:'quan',description:'Quần thời trang',createdAt:new Date()}
];

let PRODUCTS = Array.from({length:12}).map((_,i)=>({
  _id:`p${i+1}`,name:`Sản phẩm ${i+1}`,slug:`san-pham-${i+1}`,
  brand:BRANDS[i%2]._id,category:CATEGORIES[i%2]._id,
  productStatus:{statusName:(i%3===0?'Bán chạy':i%3===1?'Trending':'New')},
  short_description:`Mô tả ngắn ${i+1}`,long_description:`Mô tả dài ${i+1}`,
  variants_count:2+(i%3),price_min:100000*(i+1),price_max:150000*(i+1),
  stock_total:5+(i%10),cover:'https://picsum.photos/seed/'+(i+7)+'/80/80',
  variants:[{sku:`SKU-${i+1}-S`,price:150000+i*5000,stock_quantity:10+i}]
}));
let PRODUCT_COLORS   = [{_id:'pc1',product:'p1',product_name:'Sản phẩm 1',color_name:'Đen',color_code:'#000000',createdAt:new Date()}];
let PRODUCT_SIZES    = [{_id:'ps1',product:'p1',product_name:'Sản phẩm 1',size_name:'M',size_order:2,createdAt:new Date()}];
let PRODUCT_VARIANTS = [{sku:'SKU-1-S',product:'p1',product_name:'Sản phẩm 1',color:'pc1',color_name:'Đen',size:'ps1',size_name:'M',price:150000,stock_quantity:10}];

let USERS = Array.from({length:10}).map((_,i)=>({
  _id:`u${i+1}`,full_name:`Người dùng ${i+1}`,email:`user${i+1}@example.com`,
  role:i%4===0?'admin':'customer',is_verified:i%3===0,loyalty_points:10*i,
  createdAt:new Date(Date.now()-i*86400000)
}));
let ADDRESSES = [{_id:'ad1',user:'u1',address_line:'12 Nguyễn Huệ, Q1, HCM',is_default:true,createdAt:new Date()}];
let REVIEWS   = [{_id:'rv1',product:'p1',user:'u2',guest_name:null,guest_email:null,comment:'Quá xịn!',rating:5,createdAt:new Date()}];
let WISHLISTS = [{_id:'wl1',user:'u3',product_variant_sku:'SKU-1-S',createdAt:new Date()}];

let DISCOUNTS = [
  {code:'ABCDE',discount_value:10,usage_limit:5,usage_count:2,is_active:true,createdAt:new Date()},
  {code:'SALE1',discount_value:15,usage_limit:3,usage_count:1,is_active:true,createdAt:new Date()},
  {code:'OFF50',discount_value:50,usage_limit:1,usage_count:0,is_active:false,createdAt:new Date()}
];

let ORDERS    = Array.from({length:9}).map((_,i)=>({
  _id:`OD${1000+i}`,
  user:USERS[i%USERS.length],
  createdAt:new Date(Date.now()-i*3600*1000*12),
  total_amount:400000+i*50000,
  final_amount:380000+i*45000,
  discount_code:i%3===0?{code:'ABCDE'}:null,
  current_status:['pending','confirmed','shipping','delivered','cancelled'][i%5],
  status_history:[
    {status:'pending',timestamp:new Date(Date.now()-(i*3+2)*3600000)},
    {status:'confirmed',timestamp:new Date(Date.now()-(i*3+1)*3600000)}
  ],
  items:[{product_variant_sku:`SKU-${i+1}-S`,quantity:1+(i%2),price_at_purchase:190000+i*10000,name_snapshot:`Sản phẩm ${i+1} - Size S`}],
  address:{address_line:`Số ${i+10} Đường ABC, Quận ${i+1}`}
}));

/* ---------------- Dashboard ---------------- */
app.get('/admin', (req, res) => {
  const charts = {
    revenue:{labels:['T1','T2','T3','T4','T5','T6'],revenue:[12,18,10,22,19,25],profit:[3,5,2,6,5,8]},
    orders:{labels:['T1','T2','T3','T4','T5','T6'],orders:[120,180,150,220,190,240]},
    compare:{labels:['Q1','Q2','Q3','Q4'],revenue:[40,55,48,70],profit:[10,14,12,18],orders:[120,180,160,240]}
  };
  const metrics = { totalUsers:USERS.length,ordersCount:ORDERS.length,revenue:75299000,profit:12600000 };
  const kpis = [
    {label:'Tổng người dùng',value:metrics.totalUsers,delta:5,icon:'users'},
    {label:'Đơn hàng',value:metrics.ordersCount,delta:12,icon:'receipt'},
    {label:'Doanh thu',value:metrics.revenue,valueDisplay:metrics.revenue.toLocaleString('vi-VN',{style:'currency',currency:'VND'}),delta:8,icon:'credit-card'},
    {label:'Lợi nhuận',value:metrics.profit,valueDisplay:metrics.profit.toLocaleString('vi-VN',{style:'currency',currency:'VND'}),delta:-3,icon:'badge-dollar-sign'},
  ];
  const topProducts = PRODUCTS.slice(0,10).map((p,i)=>({name:p.name,total_sold:100-i*3}));

  res.render('dashboard', {
    title:'Dashboard',
    pageHeading:'Dashboard',
    charts, kpis, topProducts,
    filters:{ granularity:'month', mode:req.query.mode || 'simple' }
  });
});

/* ---------------- Products ---------------- */
app.get('/admin/products',(req,res)=>{
  const { page=1 } = req.query;
  const mapped = PRODUCTS.map(p=>({
    ...p,
    brand:BRANDS.find(b=>b._id===p.brand),
    category:CATEGORIES.find(c=>c._id===p.category)
  }));
  const p = paginate(mapped, page, 10);
  res.render('products_index',{
    title:'Sản phẩm',
    pageHeading:'Quản lý sản phẩm',
    items:p.items, brands:BRANDS, categories:CATEGORIES,
    query:req.query, pagination:{...p, baseUrl:baseUrl(req)}
  });
});
app.get('/admin/products/new',(req,res)=>{
  res.render('product_form',{title:'Thêm sản phẩm',pageHeading:'Thêm sản phẩm',brands:BRANDS,categories:CATEGORIES});
});
app.get('/admin/products/:id',(req,res)=>{
  const product = PRODUCTS.find(x=>x._id===req.params.id);
  if(!product) return res.status(404).send('Không tìm thấy sản phẩm');
  res.render('product_form',{title:'Chỉnh sửa sản phẩm',pageHeading:'Chỉnh sửa sản phẩm',product,brands:BRANDS,categories:CATEGORIES});
});
app.post('/admin/products',(req,res)=>{
  const id='p'+(PRODUCTS.length+1);
  const variants = Array.isArray(req.body.variants)?req.body.variants:[];
  const b={
    _id:id,name:req.body.name,slug:req.body.slug,brand:req.body.brand,category:req.body.category,
    short_description:req.body.short_description,long_description:req.body.long_description,
    productStatus:{statusName:req.body.statusName||'New'},
    variants,variants_count:variants.length,price_min:0,price_max:0,stock_total:0
  };
  PRODUCTS.unshift(b); res.redirect('/admin/products');
});
app.post('/admin/products/:id',(req,res)=>{
  const i=PRODUCTS.findIndex(x=>x._id===req.params.id);
  if(i>-1){
    PRODUCTS[i]={...PRODUCTS[i],
      name:req.body.name,slug:req.body.slug,brand:req.body.brand,category:req.body.category,
      short_description:req.body.short_description,long_description:req.body.long_description,
      productStatus:{statusName:req.body.statusName||PRODUCTS[i].productStatus?.statusName||'New'}
    };
  }
  res.redirect('/admin/products');
});
app.post('/admin/products/:id/delete',(req,res)=>{PRODUCTS=PRODUCTS.filter(x=>x._id!==req.params.id); res.redirect('/admin/products');});

/* ---------------- Variants / Colors / Sizes ---------------- */
app.get('/admin/product-variants',(req,res)=>{
  const p=paginate(PRODUCT_VARIANTS,1,50);
  res.render('entity_index',{title:'Biến thể',pageHeading:'Biến thể',items:p.items,fields:['sku','product','color','size','price','stock_quantity'],pagination:{...p,baseUrl:'/admin/product-variants?page='}});
});
app.get('/admin/product-variants/new',(req,res)=>res.render('entity_form',{title:'Thêm biến thể',pageHeading:'Thêm biến thể',item:null,fields:['product','sku','color','size','price','stock_quantity'],actionBase:'/admin/product-variants'}));
app.get('/admin/product-variants/:id',(req,res)=>{const item=PRODUCT_VARIANTS.find(x=>x.sku==req.params.id); if(!item) return res.status(404).send('Not found'); res.render('entity_form',{title:'Sửa biến thể',pageHeading:'Sửa biến thể',item,fields:['product','sku','color','size','price','stock_quantity'],actionBase:'/admin/product-variants'});});
app.post('/admin/product-variants',(req,res)=>{PRODUCT_VARIANTS.unshift({sku:req.body.sku,product:req.body.product,color:req.body.color,size:req.body.size,price:Number(req.body.price||0),stock_quantity:Number(req.body.stock_quantity||0)}); res.redirect('/admin/product-variants');});
app.post('/admin/product-variants/:id',(req,res)=>{const i=PRODUCT_VARIANTS.findIndex(x=>x.sku==req.params.id); if(i>-1){PRODUCT_VARIANTS[i]={...PRODUCT_VARIANTS[i],product:req.body.product,color:req.body.color,size:req.body.size,price:Number(req.body.price||0),stock_quantity:Number(req.body.stock_quantity||0)}} res.redirect('/admin/product-variants');});
app.post('/admin/product-variants/:id/delete',(req,res)=>{PRODUCT_VARIANTS=PRODUCT_VARIANTS.filter(x=>x.sku!=req.params.id); res.redirect('/admin/product-variants');});

app.get('/admin/product-colors',(req,res)=>{const p=paginate(PRODUCT_COLORS,1,50); res.render('entity_index',{title:'Màu sắc',pageHeading:'Màu sắc',items:p.items,fields:['product','color_name','color_code','createdAt'],pagination:{...p,baseUrl:'/admin/product-colors?page='}});});
app.get('/admin/product-colors/new',(req,res)=>res.render('entity_form',{title:'Thêm màu',pageHeading:'Thêm màu',item:null,fields:['product','color_name','color_code'],actionBase:'/admin/product-colors'}));
app.get('/admin/product-colors/:id',(req,res)=>{const item=PRODUCT_COLORS.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); res.render('entity_form',{title:'Sửa màu',pageHeading:'Sửa màu',item,fields:['product','color_name','color_code'],actionBase:'/admin/product-colors'});});
app.post('/admin/product-colors',(req,res)=>{PRODUCT_COLORS.unshift({_id:'pc'+Date.now(),product:req.body.product,color_name:req.body.color_name,color_code:req.body.color_code,createdAt:new Date()}); res.redirect('/admin/product-colors');});
app.post('/admin/product-colors/:id',(req,res)=>{const i=PRODUCT_COLORS.findIndex(x=>x._id==req.params.id); if(i>-1){PRODUCT_COLORS[i]={...PRODUCT_COLORS[i],product:req.body.product,color_name:req.body.color_name,color_code:req.body.color_code}} res.redirect('/admin/product-colors');});
app.post('/admin/product-colors/:id/delete',(req,res)=>{PRODUCT_COLORS=PRODUCT_COLORS.filter(x=>x._id!=req.params.id); res.redirect('/admin/product-colors');});

app.get('/admin/product-sizes',(req,res)=>{const p=paginate(PRODUCT_SIZES,1,50); res.render('entity_index',{title:'Kích cỡ',pageHeading:'Kích cỡ',items:p.items,fields:['product','size_name','size_order','createdAt'],pagination:{...p,baseUrl:'/admin/product-sizes?page='}});});
app.get('/admin/product-sizes/new',(req,res)=>res.render('entity_form',{title:'Thêm size',pageHeading:'Thêm size',item:null,fields:['product','size_name','size_order'],actionBase:'/admin/product-sizes'}));
app.get('/admin/product-sizes/:id',(req,res)=>{const item=PRODUCT_SIZES.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); res.render('entity_form',{title:'Sửa size',pageHeading:'Sửa size',item,fields:['product','size_name','size_order'],actionBase:'/admin/product-sizes'});});
app.post('/admin/product-sizes',(req,res)=>{PRODUCT_SIZES.unshift({_id:'ps'+Date.now(),product:req.body.product,size_name:req.body.size_name,size_order:Number(req.body.size_order||0),createdAt:new Date()}); res.redirect('/admin/product-sizes');});
app.post('/admin/product-sizes/:id',(req,res)=>{const i=PRODUCT_SIZES.findIndex(x=>x._id==req.params.id); if(i>-1){PRODUCT_SIZES[i]={...PRODUCT_SIZES[i],product:req.body.product,size_name:req.body.size_name,size_order:Number(req.body.size_order||0)}} res.redirect('/admin/product-sizes');});
app.post('/admin/product-sizes/:id/delete',(req,res)=>{PRODUCT_SIZES=PRODUCT_SIZES.filter(x=>x._id!=req.params.id); res.redirect('/admin/product-sizes');});

/* ---------------- Brands / Categories (dùng entity_* generic) ---------------- */
app.get('/admin/brands',(req,res)=>{const p=paginate(BRANDS,1,100); res.render('entity_index',{title:'Thương hiệu',pageHeading:'Thương hiệu',items:p.items,fields:['name','slug','createdAt'],pagination:{...p,baseUrl:'/admin/brands?page='}});});
app.get('/admin/brands/new',(req,res)=>res.render('entity_form',{title:'Thêm thương hiệu',pageHeading:'Thêm thương hiệu',item:null,fields:['name','slug'],actionBase:'/admin/brands'}));
app.get('/admin/brands/:id',(req,res)=>{const item=BRANDS.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); res.render('entity_form',{title:'Sửa thương hiệu',pageHeading:'Sửa thương hiệu',item,fields:['name','slug'],actionBase:'/admin/brands'});});
app.post('/admin/brands',(req,res)=>{BRANDS.unshift({_id:'b'+Date.now(),name:req.body.name,slug:req.body.slug,createdAt:new Date()}); res.redirect('/admin/brands');});
app.post('/admin/brands/:id',(req,res)=>{const i=BRANDS.findIndex(x=>x._id==req.params.id); if(i>-1){BRANDS[i]={...BRANDS[i],name:req.body.name,slug:req.body.slug}} res.redirect('/admin/brands');});
app.post('/admin/brands/:id/delete',(req,res)=>{BRANDS=BRANDS.filter(x=>x._id!=req.params.id); res.redirect('/admin/brands');});

app.get('/admin/categories',(req,res)=>{const p=paginate(CATEGORIES,1,100); res.render('entity_index',{title:'Danh mục',pageHeading:'Danh mục',items:p.items,fields:['name','slug','description','createdAt'],pagination:{...p,baseUrl:'/admin/categories?page='}});});
app.get('/admin/categories/new',(req,res)=>res.render('entity_form',{title:'Thêm danh mục',pageHeading:'Thêm danh mục',item:null,fields:['name','slug','description'],actionBase:'/admin/categories'}));
app.get('/admin/categories/:id',(req,res)=>{const item=CATEGORIES.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); res.render('entity_form',{title:'Sửa danh mục',pageHeading:'Sửa danh mục',item,fields:['name','slug','description'],actionBase:'/admin/categories'});});
app.post('/admin/categories',(req,res)=>{CATEGORIES.unshift({_id:'c'+Date.now(),name:req.body.name,slug:req.body.slug,description:req.body.description,createdAt:new Date()}); res.redirect('/admin/categories');});
app.post('/admin/categories/:id',(req,res)=>{const i=CATEGORIES.findIndex(x=>x._id==req.params.id); if(i>-1){CATEGORIES[i]={...CATEGORIES[i],name:req.body.name,slug:req.body.slug,description:req.body.description}} res.redirect('/admin/categories');});
app.post('/admin/categories/:id/delete',(req,res)=>{CATEGORIES=CATEGORIES.filter(x=>x._id!=req.params.id); res.redirect('/admin/categories');});

/* ---------------- Orders ---------------- */
app.get('/admin/orders',(req,res)=>{
  const { page=1 } = req.query;
  const p = paginate(ORDERS, page, 10);
  res.render('orders_index',{
    title:'Đơn hàng',
    pageHeading:'Đơn hàng',
    items:p.items,
    query:req.query,
    pagination:{...p,baseUrl:baseUrl(req)}
  });
});
app.get('/admin/orders/:id',(req,res)=>{
  const order = ORDERS.find(o=>o._id===req.params.id);
  if(!order) return res.status(404).send('Không tìm thấy đơn');
  res.render('order_detail',{title:`Đơn ${order._id}`,pageHeading:`Đơn #${order._id}`,order});
});
app.post('/admin/orders/:id/status',(req,res)=>{
  const order = ORDERS.find(o=>o._id===req.params.id);
  if(order && req.body.status){
    order.current_status = req.body.status;
    order.status_history.push({status:req.body.status,timestamp:new Date()});
  }
  res.redirect('/admin/orders/'+req.params.id);
});

/* ---------------- Discounts ---------------- */
app.get('/admin/discounts',(req,res)=>{
  const p = paginate(DISCOUNTS, 1, DISCOUNTS.length);
  res.render('discounts_index',{title:'Mã giảm giá',pageHeading:'Mã giảm giá',items:p.items,pagination:{...p,baseUrl:'/admin/discounts?page='}});
});
app.post('/admin/discounts',(req,res)=>{
  const { code, discount_value, usage_limit, is_active } = req.body;
  if(code && String(code).length===5){
    DISCOUNTS.unshift({
      code:String(code).toUpperCase(),
      discount_value:Number(discount_value||0),
      usage_limit:Number(usage_limit||1),
      usage_count:0,
      is_active:Boolean(is_active),
      createdAt:new Date()
    });
  }
  res.redirect('/admin/discounts');
});
app.post('/admin/discounts/:code/delete',(req,res)=>{DISCOUNTS=DISCOUNTS.filter(x=>x.code!==req.params.code); res.redirect('/admin/discounts');});

/* ---------------- Users ---------------- */
app.get('/admin/users',(req,res)=>{const p=paginate(USERS,1,20); res.render('users_index',{title:'Người dùng',pageHeading:'Người dùng',items:p.items});});
app.post('/admin/users/:id/delete',(req,res)=>{USERS=USERS.filter(x=>x._id!==req.params.id); res.redirect('/admin/users');});

/* ---------------- Addresses / Reviews / Wishlists (generic views) ---------------- */
function renderEntityIndex(res, title, items, fields) {
  res.render('entity_index',{ title, pageHeading:title, items, fields, pagination:{itemsCount:items.length} });
}
function renderEntityForm(res, title, item, fields, actionBase) {
  res.render('entity_form',{ title, pageHeading:title, item, fields, actionBase });
}

app.get('/admin/addresses',(req,res)=>renderEntityIndex(res,'Địa chỉ',ADDRESSES,['user','address_line','is_default','createdAt']));
app.get('/admin/addresses/new',(req,res)=>renderEntityForm(res,'Thêm địa chỉ',null,['user','address_line','is_default'],'/admin/addresses'));
app.get('/admin/addresses/:id',(req,res)=>{const item=ADDRESSES.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); renderEntityForm(res,'Sửa địa chỉ',item,['user','address_line','is_default'],'/admin/addresses');});
app.post('/admin/addresses',(req,res)=>{ADDRESSES.unshift({_id:'ad'+Date.now(),user:req.body.user,address_line:req.body.address_line,is_default:Boolean(req.body.is_default),createdAt:new Date()}); res.redirect('/admin/addresses');});
app.post('/admin/addresses/:id',(req,res)=>{const i=ADDRESSES.findIndex(x=>x._id==req.params.id); if(i>-1){ADDRESSES[i]={...ADDRESSES[i],user:req.body.user,address_line:req.body.address_line,is_default:Boolean(req.body.is_default)}} res.redirect('/admin/addresses');});
app.post('/admin/addresses/:id/delete',(req,res)=>{ADDRESSES=ADDRESSES.filter(x=>x._id!=req.params.id); res.redirect('/admin/addresses');});

app.get('/admin/reviews',(req,res)=>renderEntityIndex(res,'Đánh giá',REVIEWS,['product','user','guest_name','guest_email','rating','comment','createdAt']));
app.get('/admin/reviews/new',(req,res)=>renderEntityForm(res,'Thêm đánh giá',null,['product','user','guest_name','guest_email','rating','comment'],'/admin/reviews'));
app.get('/admin/reviews/:id',(req,res)=>{const item=REVIEWS.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); renderEntityForm(res,'Sửa đánh giá',item,['product','user','guest_name','guest_email','rating','comment'],'/admin/reviews');});
app.post('/admin/reviews',(req,res)=>{REVIEWS.unshift({_id:'rv'+Date.now(),product:req.body.product,user:req.body.user,guest_name:req.body.guest_name||null,guest_email:req.body.guest_email||null,comment:req.body.comment,rating:Number(req.body.rating||0),createdAt:new Date()}); res.redirect('/admin/reviews');});
app.post('/admin/reviews/:id',(req,res)=>{const i=REVIEWS.findIndex(x=>x._id==req.params.id); if(i>-1){REVIEWS[i]={...REVIEWS[i],product:req.body.product,user:req.body.user,guest_name:req.body.guest_name,guest_email:req.body.guest_email,comment:req.body.comment,rating:Number(req.body.rating||0)}} res.redirect('/admin/reviews');});
app.post('/admin/reviews/:id/delete',(req,res)=>{REVIEWS=REVIEWS.filter(x=>x._id!=req.params.id); res.redirect('/admin/reviews');});

app.get('/admin/wishlists',(req,res)=>renderEntityIndex(res,'Wishlist',WISHLISTS,['user','product_variant_sku','createdAt']));
app.get('/admin/wishlists/new',(req,res)=>renderEntityForm(res,'Thêm wishlist',null,['user','product_variant_sku'],'/admin/wishlists'));
app.get('/admin/wishlists/:id',(req,res)=>{const item=WISHLISTS.find(x=>x._id==req.params.id); if(!item) return res.status(404).send('Not found'); renderEntityForm(res,'Sửa wishlist',item,['user','product_variant_sku'],'/admin/wishlists');});
app.post('/admin/wishlists',(req,res)=>{WISHLISTS.unshift({_id:'wl'+Date.now(),user:req.body.user,product_variant_sku:req.body.product_variant_sku,createdAt:new Date()}); res.redirect('/admin/wishlists');});
app.post('/admin/wishlists/:id',(req,res)=>{const i=WISHLISTS.findIndex(x=>x._id==req.params.id); if(i>-1){WISHLISTS[i]={...WISHLISTS[i],user:req.body.user,product_variant_sku:req.body.product_variant_sku}} res.redirect('/admin/wishlists');});
app.post('/admin/wishlists/:id/delete',(req,res)=>{WISHLISTS=WISHLISTS.filter(x=>x._id!=req.params.id); res.redirect('/admin/wishlists');});

/* ---------------- Account: đổi mật khẩu & đăng xuất ---------------- */
app.get('/admin/account/password', (req, res) => {
  res.render('account_password', {
    title: 'Đổi mật khẩu',
    pageHeading: 'Đổi mật khẩu',
    errorMsg: null,
    successMsg: null
  });
});

app.post('/admin/account/password', (req, res) => {
  const { current_password, new_password, confirm_password } = req.body || {};
  const viewBase = { title: 'Đổi mật khẩu', pageHeading: 'Đổi mật khẩu' };

  if (!current_password || !new_password || !confirm_password) {
    return res.render('account_password', { ...viewBase, errorMsg: 'Vui lòng nhập đủ thông tin.', successMsg: null });
  }
  if (current_password !== ADMIN_ACCOUNT.password) {
    return res.render('account_password', { ...viewBase, errorMsg: 'Mật khẩu hiện tại không đúng.', successMsg: null });
  }
  if (new_password !== confirm_password) {
    return res.render('account_password', { ...viewBase, errorMsg: 'Xác nhận mật khẩu không khớp.', successMsg: null });
  }
  if (new_password.length < 6) {
    return res.render('account_password', { ...viewBase, errorMsg: 'Mật khẩu mới tối thiểu 6 ký tự.', successMsg: null });
  }
  ADMIN_ACCOUNT.password = new_password;
  return res.render('account_password', { ...viewBase, errorMsg: null, successMsg: 'Đổi mật khẩu thành công.' });
});

app.post('/admin/logout', (req, res) => {
  res.redirect('/admin?s=Đã đăng xuất'); // (trước bị thừa khoảng trắng sau '?')
});

/* ---------------- Root ---------------- */
app.get('/', (req,res)=>res.redirect('/admin'));

/* ---------------- Start ---------------- */
const PORT = process.env.PORT || 4000;
app.listen(PORT, ()=>console.log(`✅ Admin UI: http://localhost:${PORT}/admin`));
