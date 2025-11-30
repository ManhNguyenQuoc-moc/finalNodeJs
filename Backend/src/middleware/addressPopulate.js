// middlewares/addressPopulate.js
module.exports = function fillAddressLine(next) {
  // 'this' ở đây phải là document => nên dùng function khi bind
  if (!this.address_line) {
    this.address_line = `${this.detail}, ${this.ward}, ${this.district}, ${this.city}`;
  }
  next();
};
