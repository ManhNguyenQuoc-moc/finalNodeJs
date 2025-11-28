// Backend/src/models/index.js
const mongoose = require("mongoose");

const Brand = require("./Brand");
const Cart = require("./Cart");
const Category = require("./Category");
const DiscountCode = require("./DiscountCode");
const Order = require("./Order");
const Product = require("./Product");
const ProductColor = require("./ProductColor");
const ProductSize = require("./ProductSize");
const ProductVariant = require("./ProductVariant");
const Review = require("./Review");
const User = require("./User");
const Wishlist = require("./Wishlist");
const Address = require("./Address");
// (Nếu bạn có Address model và muốn export, thêm: const Address = require('./Address'); )

/* ----------------------- Helpers ----------------------- */
function enableVirtuals(model) {
  const sch = model.schema;
  sch.set("toObject", { virtuals: true });
  sch.set("toJSON", { virtuals: true });
}

/* ----------------------- Virtuals ----------------------- */
// Product: alias brand_id/category_id -> brand/category
if (!Product.schema.virtuals.brand_id) {
  Product.schema
    .virtual("brand_id")
    .get(function () {
      return this.brand;
    })
    .set(function (v) {
      this.brand = v;
    });
}
if (!Product.schema.virtuals.category_id) {
  Product.schema
    .virtual("category_id")
    .get(function () {
      return this.category;
    })
    .set(function (v) {
      this.category = v;
    });
}
enableVirtuals(Product);

// Review: alias product_id/user_id
if (!Review.schema.virtuals.product_id) {
  Review.schema
    .virtual("product_id")
    .get(function () {
      return this.product;
    })
    .set(function (v) {
      this.product = v;
    });
}
if (!Review.schema.virtuals.user_id) {
  Review.schema
    .virtual("user_id")
    .get(function () {
      return this.user;
    })
    .set(function (v) {
      this.user = v;
    });
}
enableVirtuals(Review);

// Cart: virtual 'user' populate từ user_id
if (!Cart.schema.virtuals.user) {
  Cart.schema.virtual("user", {
    ref: "User",
    localField: "user_id",
    foreignField: "_id",
    justOne: true,
  });
}
enableVirtuals(Cart);

// Order: alias user_id/address_id/discount_code_id
if (!Order.schema.virtuals.user_id) {
  Order.schema
    .virtual("user_id")
    .get(function () {
      return this.user;
    })
    .set(function (v) {
      this.user = v;
    });
}
if (!Order.schema.virtuals.address_id) {
  Order.schema
    .virtual("address_id")
    .get(function () {
      return this.address;
    })
    .set(function (v) {
      this.address = v;
    });
}
if (!Order.schema.virtuals.discount_code_id) {
  Order.schema
    .virtual("discount_code_id")
    .get(function () {
      return this.discount_code;
    })
    .set(function (v) {
      this.discount_code = v;
    });
}
enableVirtuals(Order);

/* ----------------------- Strict mode ----------------------- */
// App đang push nhiều field snapshot -> nới lỏng
Cart.schema.set("strict", false);
Order.schema.set("strict", false);
Product.schema.set("strict", false);
// Review.schema.set('strict', false); // nếu cần

/* ----------------------- Lean virtuals ----------------------- */
function attachLeanVirtuals(model) {
  const sch = model.schema;
  if (sch.__leanPatched) return;
  sch.pre(["find", "findOne", "findById"], function () {
    if (this.mongooseOptions().lean) {
      this.setOptions({ lean: { virtuals: true } });
    }
  });
  sch.__leanPatched = true;
}

attachLeanVirtuals(Product);
attachLeanVirtuals(Review);
attachLeanVirtuals(Cart);
attachLeanVirtuals(Order);

/* ----------------------- EXPORTS ----------------------- */
module.exports = {
  Brand,
  Cart,
  Category,
  DiscountCode,
  Order,
  Product,
  ProductColor,
  ProductSize,
  ProductVariant, // ✅ NHỚ EXPORT
  Review,
  User,
  Wishlist,
  Address,
};
