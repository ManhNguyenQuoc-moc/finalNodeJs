// services/discountCodeService.js
const mongoose = require("mongoose");
const discountCodeRepo = require("../repositories/discountCodeRepo");

class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
  }
}
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.statusCode = 404;
  }
}

// helper nếu bạn đã có handleTransaction riêng thì thay cho cái này
async function withTransaction(fn) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}

// CREATE
async function createDiscountCode(dto) {
  const code = normalizeCode(dto.code);
  if (!code) throw new BadRequestError("Code is required");
  if (code.length !== 5) {
    throw new BadRequestError("Code must be exactly 5 characters");
  }

  const discount_value = Number(dto.discount_value);
  const usage_limit = dto.usage_limit != null ? Number(dto.usage_limit) : null;

  if (!Number.isFinite(discount_value) || discount_value <= 0) {
    throw new BadRequestError("discount_value must be > 0");
  }
  if (usage_limit != null && (!Number.isFinite(usage_limit) || usage_limit <= 0)) {
    throw new BadRequestError("usage_limit must be > 0 if provided");
  }

  const existing = await discountCodeRepo.findByCode(code);
  if (existing) {
    throw new BadRequestError("Discount code already exists");
  }

  const payload = {
    code,
    discount_value,
    usage_limit,
    is_active: dto.is_active !== undefined ? !!dto.is_active : true,
  };

  const created = await discountCodeRepo.create(payload);
  return created;
}

// LIST
async function listDiscountCodes(query = {}) {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);

  const filter = {};
  if (query.code) filter.code = normalizeCode(query.code);
  if (query.is_active === "true") filter.is_active = true;
  if (query.is_active === "false") filter.is_active = false;

  return discountCodeRepo.findAll(filter, { page, limit });
}

// GET BY ID
async function getDiscountCode(id) {
  const doc = await discountCodeRepo.findById(id);
  if (!doc) throw new NotFoundError("Discount code not found");
  return doc;
}

// UPDATE
async function updateDiscountCode(id, dto) {
  const existing = await discountCodeRepo.findById(id);
  if (!existing) throw new NotFoundError("Discount code not found");

  const patch = {};

  if (dto.code !== undefined) {
    const newCode = normalizeCode(dto.code);
    if (!newCode) throw new BadRequestError("Code is required");
    // optional length check
    if (newCode.length !== 5) {
      throw new BadRequestError("Code must be exactly 5 characters");
    }

    const other = await discountCodeRepo.findByCode(newCode);
    if (other && String(other._id) !== String(id)) {
      throw new BadRequestError("Discount code already exists");
    }
    patch.code = newCode;
  }

  if (dto.discount_value !== undefined) {
    const v = Number(dto.discount_value);
    if (!Number.isFinite(v) || v <= 0) {
      throw new BadRequestError("discount_value must be > 0");
    }
    patch.discount_value = v;
  }

  if (dto.usage_limit !== undefined) {
    const limit = dto.usage_limit != null ? Number(dto.usage_limit) : null;
    if (limit != null && (!Number.isFinite(limit) || limit <= 0)) {
      throw new BadRequestError("usage_limit must be > 0 if provided");
    }
    patch.usage_limit = limit;
  }

  if (dto.is_active !== undefined) {
    patch.is_active = !!dto.is_active;
  }

  const updated = await discountCodeRepo.updateById(id, patch);
  return updated;
}

// DELETE
async function deleteDiscountCode(id) {
  const deleted = await discountCodeRepo.deleteById(id);
  if (!deleted) throw new NotFoundError("Discount code not found");
  return deleted;
}

// APPLY (validate + tăng usage_count)
async function applyDiscountCode(rawCode) {
  const code = normalizeCode(rawCode);
  if (!code) throw new BadRequestError("Code is required");

  return withTransaction(async (session) => {
    const doc = await discountCodeRepo.findByCode(code);
    if (!doc) throw new NotFoundError("Discount code not found");

    if (!doc.is_active) throw new BadRequestError("Discount code is not active");

    if (doc.usage_limit != null && doc.usage_count >= doc.usage_limit) {
      throw new BadRequestError("Discount code usage limit reached");
    }

    const updated = await discountCodeRepo.incrementUsage(code, session);
    return updated;
  });
}

module.exports = {
  createDiscountCode,
  listDiscountCodes,
  getDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  applyDiscountCode,
  BadRequestError,
  NotFoundError,
};
