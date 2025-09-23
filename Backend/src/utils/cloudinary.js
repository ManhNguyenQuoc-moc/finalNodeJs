const cloudinary = require("../config/cloudinary");

async function uploadToCloudinary(files, folder = "products") {
  const results = [];
  for (const file of files) {
    const res = await cloudinary.uploader.upload(file.path, { folder });
    results.push({ url: res.secure_url, is_primary: false });
  }

  // Đặt ảnh đầu tiên làm primary
  if (results.length > 0) results[0].is_primary = true;

  return results;
}

module.exports = { uploadToCloudinary };
