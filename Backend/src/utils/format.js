// src/utils/format.js
const fmtVND = new Intl.NumberFormat("vi-VN");
const money = (n) => `${fmtVND.format(Number(n || 0))} đ`;

module.exports = { money };
