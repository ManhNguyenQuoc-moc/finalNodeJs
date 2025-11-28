const addressRepository = require("../repositories/addressRepository");

class AddressService {
  async getList(userId) {
    return await addressRepository.findByUser(userId);
  }

  async addAddress(userId, data) {
    // data gồm: { city, district, ward, detail, is_default }

    // Nếu user chọn đây là mặc định -> Reset các cái cũ trước
    if (data.is_default) {
      await addressRepository.unsetDefaultForUser(userId);
    }
    // Nếu đây là địa chỉ đầu tiên của user -> Tự động set mặc định
    else {
      const existing = await addressRepository.findByUser(userId);
      if (existing.length === 0) {
        data.is_default = true;
      }
    }

    // Tạo address_line đầy đủ
    const address_line = `${data.detail}, ${data.ward}, ${data.district}, ${data.city}`;

    return await addressRepository.create({
      user: userId,
      ...data,
      address_line,
    });
  }

  async updateAddress(userId, addressId, data) {
    const address = await addressRepository.findById(addressId);
    if (!address) throw new Error("Địa chỉ không tồn tại");
    if (address.user.toString() !== userId.toString())
      throw new Error("Không có quyền truy cập");

    if (data.is_default) {
      await addressRepository.unsetDefaultForUser(userId);
    }

    // Cập nhật lại address_line nếu có thay đổi thành phần
    if (data.city || data.district || data.ward || data.detail) {
      const newCity = data.city || address.city;
      const newDist = data.district || address.district;
      const newWard = data.ward || address.ward;
      const newDetail = data.detail || address.detail;
      data.address_line = `${newDetail}, ${newWard}, ${newDist}, ${newCity}`;
    }

    return await addressRepository.update(addressId, data);
  }

  async deleteAddress(userId, addressId) {
    const address = await addressRepository.findById(addressId);
    if (!address) throw new Error("Địa chỉ không tồn tại");
    if (address.user.toString() !== userId.toString())
      throw new Error("Không có quyền truy cập");

    return await addressRepository.delete(addressId);
  }

  async setDefault(userId, addressId) {
    const address = await addressRepository.findById(addressId);
    if (!address) throw new Error("Địa chỉ không tồn tại");

    // Reset hết
    await addressRepository.unsetDefaultForUser(userId);

    // Set cái này là true
    return await addressRepository.update(addressId, { is_default: true });
  }
}

module.exports = new AddressService();
