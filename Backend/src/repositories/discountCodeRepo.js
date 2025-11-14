// repositories/discountCodeRepo.js
const DiscountCode = require("../models/DiscountCode");

async function create(data, session) {
  const doc = new DiscountCode(data);
  return session ? doc.save({ session }) : doc.save();
}

async function findById(id) {
  return DiscountCode.findById(id);
}

async function findByCode(code) {
  return DiscountCode.findOne({ code });
}

async function findAll(filter = {}, { limit = 50, page = 1 } = {}) {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    DiscountCode.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DiscountCode.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

async function updateById(id, data, session) {
  return DiscountCode.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
    ...(session ? { session } : {}),
  });
}

async function deleteById(id, session) {
  return DiscountCode.findByIdAndDelete(id, session ? { session } : {});
}

// tăng usage_count an toàn
async function incrementUsage(code, session) {
  return DiscountCode.findOneAndUpdate(
    { code },
    { $inc: { usage_count: 1 } },
    {
      new: true,
      ...(session ? { session } : {}),
    }
  );
}

module.exports = {
  create,
  findById,
  findByCode,
  findAll,
  updateById,
  deleteById,
  incrementUsage,
};
