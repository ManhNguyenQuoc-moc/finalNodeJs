// utils/slug.util.js
function toSlug(str = "") {
    return String(str)
        .normalize("NFD") // chuẩn hóa Unicode để tách dấu
        .replace(/[\u0300-\u036f]/g, "") // bỏ dấu
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-") // ký tự không hợp lệ -> "-"
        .replace(/^-+|-+$/g, ""); // xóa "-" đầu/cuối
}

module.exports = { toSlug };
