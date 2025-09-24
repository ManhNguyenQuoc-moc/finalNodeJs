const cloudinary = require("../config/cloudinary");

/**
 * Upload 1 file local lên Cloudinary
 * @param {string} filePath - đường dẫn file local
 * @param {string} folder - thư mục Cloudinary
 * @returns {Promise<Object>} - { secure_url, public_id }
 */
async function uploadToCloudinary(filePath, folder = "products") {
  return cloudinary.uploader.upload(filePath, { folder });
}

/**
 * Xoá file trên Cloudinary theo public_id
 */
async function deleteFromCloudinary(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Xoá file Cloudinary ${publicId} thất bại`, err);
    throw err;
  }
}

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
