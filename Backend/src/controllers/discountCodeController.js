// controllers/discountCodeController.js

const discountCodeService = require("../services/discountCodeService");

const CreateDiscountCodeRequestDTO = require("../DTO/discountCode/CreateDiscountCodeRequestDTO");
const UpdateDiscountCodeRequestDTO = require("../DTO/discountCode/UpdateDiscountCodeRequestDTO");
const ApplyDiscountCodeRequestDTO = require("../DTO/discountCode/ApplyDiscountCodeRequestDTO");

const DiscountCodeResponseDTO = require("../DTO/discountCode/DiscountCodeResponseDTO");
// const PaginationResponseDTO = require("../DTO/discountCode/PaginationResponseDTO"); // Có thể dùng hoặc không tùy response

function handleError(res, err) {
  console.error("DiscountCode error:", err);
  // Custom status code cho lỗi logic (400) khác với lỗi server (500)
  const status = err.statusCode || 400;
  return res.status(status).json({
    success: false,
    ok: false, // Thêm field này để khớp với frontend check if(res.data.ok)
    message: err.message || "Internal server error",
  });
}

exports.create = async function (req, res) {
  try {
    const dto = new CreateDiscountCodeRequestDTO(req.body);
    const created = await discountCodeService.createDiscountCode(dto);

    // Nếu là request từ Form Admin (không phải AJAX/Fetch) thì redirect
    if (req.headers["content-type"] === "application/x-www-form-urlencoded") {
      return res.redirect("/admin/discounts");
    }

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

    // Nếu request từ trình duyệt (Admin UI) -> Render EJS
    // Kiểm tra header accept hoặc URL để biết là API hay View
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
      return res.render("discounts_index", {
        title: "Quản lý mã giảm giá",
        items: result.items, // Dữ liệu thô để EJS render
        pagination: result.pagination,
        flash: {},
      });
    }

    // Nếu là API (Postman/Fetch) -> Trả JSON
    return res.json({
      success: true,
      items: result.items.map((d) => new DiscountCodeResponseDTO(d)),
      pagination: result.pagination,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

exports.getAvailable = async function (req, res) {
  try {
    // Chỉ lấy mã đang active và (usage_limit chưa set hoặc usage_count < usage_limit)
    const result = await discountCodeService.listDiscountCodes({
      is_active: "true",
      limit: 50, // Lấy tối đa 50 mã
    });

    // Lọc thủ công thêm logic usage_limit (nếu service chưa lọc kỹ)
    const availableCodes = result.items.filter(
      (d) => !d.usage_limit || d.usage_count < d.usage_limit
    );

    // Chỉ trả về data cần thiết, giấu các thông tin nhạy cảm
    const data = availableCodes.map((d) => ({
      code: d.code,
      discount_value: d.discount_value,
      description: `Giảm ${d.discount_value}%`,
    }));

    return res.json({ success: true, items: data });
  } catch (err) {
    return res.json({ success: false, items: [] }); // Không báo lỗi, chỉ trả rỗng
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
    const updated = await discountCodeService.updateDiscountCode(
      req.params.id,
      dto
    );

    // Support redirect cho Admin Form
    if (req.headers["content-type"] === "application/x-www-form-urlencoded") {
      return res.redirect("/admin/discounts");
    }

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

    // Support redirect cho Admin Form (nếu dùng form delete)
    if (req.method === "POST" || req.originalUrl.includes("delete")) {
      // Tùy cách router bạn cấu hình method
      return res.redirect("/admin/discounts");
    }

    return res.json({ success: true, data: result });
  } catch (err) {
    return handleError(res, err);
  }
};

// --- HÀM QUAN TRỌNG: XỬ LÝ CHECK MÃ Ở TRANG THANH TOÁN ---
exports.apply = async function (req, res) {
  try {
    // 1. Lấy dữ liệu từ Frontend
    const { cartTotal } = req.body; // Tổng tiền giỏ hàng
    const dto = new ApplyDiscountCodeRequestDTO(req.body); // Lấy code từ DTO

    // 2. Tìm mã trong DB (Dùng hàm list để tìm theo code mà không tăng usage)
    // Lưu ý: Chúng ta không dùng hàm applyDiscountCode của Service ở đây
    // vì hàm đó sẽ tăng usage_count ngay lập tức.
    const result = await discountCodeService.listDiscountCodes({
      code: dto.code,
      is_active: "true",
      limit: 1,
    });

    const discount = result.items[0];

    // 3. Validate
    if (!discount) {
      throw new Error("Mã giảm giá không tồn tại hoặc chưa kích hoạt");
    }

    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
      throw new Error("Mã giảm giá đã hết lượt sử dụng");
    }

    // 4. Tính toán tiền giảm
    const total = Number(cartTotal) || 0;
    // Giả sử discount_value là % (theo ảnh bạn gửi trước đó).
    // Nếu project của bạn có thể là tiền mặt, cần check thêm logic.
    const discountAmount = Math.floor((total * discount.discount_value) / 100);
    const newTotal = total - discountAmount;

    // 5. Trả về kết quả cho Frontend hiển thị
    return res.json({
      ok: true, // Frontend dùng cờ này để check success
      success: true,
      discountCode: discount.code,
      discountId: discount._id,
      discountValue: discount.discount_value,
      discountAmount: discountAmount,
      newTotal: newTotal < 0 ? 0 : newTotal,
      message: `Áp dụng mã thành công! Giảm ${discount.discount_value}%`,
    });
  } catch (err) {
    return handleError(res, err);
  }
};
