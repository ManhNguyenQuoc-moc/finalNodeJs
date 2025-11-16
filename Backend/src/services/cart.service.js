// src/services/cart.service.js
const {
  Product, ProductColor, ProductSize, ProductVariant, Cart,
} = require("../models");

/** Lấy/khởi tạo cart theo user hoặc session */
async function getOrCreateCart(req) {
  if (req.currentUser) {
    let c = await Cart.findOne({ user_id: req.currentUser._id });
    if (!c) c = await Cart.create({ user_id: req.currentUser._id, items: [] });
    return c;
  } else {
    let c = await Cart.findOne({ session_id: req.cookies.sid });
    if (!c) c = await Cart.create({ session_id: req.cookies.sid, items: [] });
    return c;
  }
}

async function addItemToCart({ cart, variant, qty }) {
  const product = await Product.findById(variant.product).lean();
  const color = variant.color ? await ProductColor.findById(variant.color).lean() : null;
  const size = variant.size ? await ProductSize.findById(variant.size).lean() : null;
  const quantityToAdd = Math.max(1, Number(qty || 1));
  const name_snapshot = product?.name || "Sản phẩm";
  const size_name_snapshot = size?.size_name || null;
  const color_name_snapshot = color?.color_name || null;
  const newItem = {
    product_id: variant.product,
    variant_sku: variant.sku,
    name_snapshot,
    price_at_time: Number(variant.price || 0),
    quantity: quantityToAdd,

    color_name_snapshot,
    size_name_snapshot,
    img_snapshot:
      (Array.isArray(variant.images) && (variant.images[0]?.url || variant.images[0])) ||
      (Array.isArray(product?.images) && (product.images[0]?.url || product.images[0])) ||
      null,

    color_id_snapshot: color?._id || null,
    size_id_snapshot: size?._id || null,
  };
  const keyOf = (it) => String(it.variant_sku || "").toLowerCase();
  const newKey = keyOf(newItem);
  const idx = (cart.items || []).findIndex((it) => keyOf(it) === newKey);
  if (idx > -1) {
    // Nếu đã có cùng SKU trong cart thì cộng dồn số lượng
    cart.items[idx].quantity = Number(cart.items[idx].quantity || 0) + quantityToAdd;
  } else {
    // Chưa có thì push item mới
    cart.items.push(newItem);
  }
  await cart.save();
  return idx > -1 ? cart.items[idx] : newItem;
}
async function mergeCartItems(targetCart, sourceCart) {
  const keyOf = (it) => String(it.variant_sku || "").toLowerCase();

  for (const item of sourceCart.items || []) {
    const idx = (targetCart.items || []).findIndex(
      (it) => keyOf(it) === keyOf(item)
    );

    if (idx > -1) {
      // cùng SKU -> cộng dồn số lượng
      targetCart.items[idx].quantity =
        Number(targetCart.items[idx].quantity || 0) +
        Number(item.quantity || 0);
    } else {
      targetCart.items.push(item);
    }
  }
}
/** Tìm variant ưu tiên theo sku; sau đó theo (product+size+color); fallback rẻ nhất */
async function findVariant({ variant_sku, product_id, size_id, color_id }) {
  console.log("FIND VARIANT CALLED WITH:", { variant_sku, product_id, size_id, color_id });

  if (variant_sku) {
    const bySku = await ProductVariant.findOne({ sku: variant_sku }).lean();
    console.log("FIND BY SKU RESULT:", bySku);
    if (bySku) return bySku;
  }

  if (!product_id) {
    console.log("NO PRODUCT_ID, RETURNING NULL");
    return null;
  }

  const q = { product: product_id };
  if (size_id) q.size = size_id;
  if (color_id) q.color = color_id;

  console.log("FIND BY PRODUCT+SIZE+COLOR QUERY:", q);
  let v = await ProductVariant.findOne(q).lean();
  console.log("RESULT PRODUCT+SIZE+COLOR:", v);

  if (!v) {
    v = await ProductVariant.findOne({ product: product_id }).sort({ price: 1 }).lean();
    console.log("RESULT PRODUCT ONLY:", v);
  }

  return v;
}

module.exports = { getOrCreateCart, addItemToCart, findVariant , mergeCartItems};
