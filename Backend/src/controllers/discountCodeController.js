// controllers/discountCodeController.js

const discountCodeService = require("../services/discountCodeService");

const CreateDiscountCodeRequestDTO = require("../DTO/discountCode/CreateDiscountCodeRequestDTO");
const UpdateDiscountCodeRequestDTO = require("../DTO/discountCode/UpdateDiscountCodeRequestDTO");
const ApplyDiscountCodeRequestDTO = require("../DTO/discountCode/ApplyDiscountCodeRequestDTO");

const DiscountCodeResponseDTO = require("../DTO/discountCode/DiscountCodeResponseDTO");
const PaginationResponseDTO = require("../DTO/discountCode/PaginationResponseDTO");

function handleError(res, err) {
  console.error("DiscountCode error:", err);
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
  });
}


exports.create = async function (req, res) {
  try {
    const dto = new CreateDiscountCodeRequestDTO(req.body);
    const created = await discountCodeService.createDiscountCode(dto);

    return res.status(201).json({
      success: true,
      data: new DiscountCodeResponseDTO(created),
    });
  } catch (err) {
    return handleError(res, err);
  }
};


exports.list = async function (req, res) {
  try {
    const result = await discountCodeService.listDiscountCodes(req.query);

    return res.json({
      success: true,
      items: result.items.map((d) => new DiscountCodeResponseDTO(d)),
      pagination: result.pagination,
    });
  } catch (err) {
    return handleError(res, err);
  }
};


exports.getById = async function (req, res) {
  try {
    const data = await discountCodeService.getDiscountCode(req.params.id);

    return res.json({
      success: true,
      data: new DiscountCodeResponseDTO(data),
    });
  } catch (err) {
    return handleError(res, err);
  }
};


exports.update = async function (req, res) {
  try {
    const dto = new UpdateDiscountCodeRequestDTO(req.body);
    const updated = await discountCodeService.updateDiscountCode(req.params.id, dto);

    return res.json({
      success: true,
      data: new DiscountCodeResponseDTO(updated),
    });
  } catch (err) {
    return handleError(res, err);
  }
};


exports.remove = async function (req, res) {
  try {
    const result = await discountCodeService.deleteDiscountCode(req.params.id);

    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
};


exports.apply = async function (req, res) {
  try {
    const dto = new ApplyDiscountCodeRequestDTO(req.body);
    const used = await discountCodeService.applyDiscountCode(dto.code);

    return res.json({
      success: true,
      data: new DiscountCodeResponseDTO(used),
    });
  } catch (err) {
    return handleError(res, err);
  }
};
