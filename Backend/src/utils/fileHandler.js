const fs = require("fs").promises;
const { uploadToCloudinary, deleteFromCloudinary } = require("./cloudinary");

/**
 * Xoá file local an toàn
 */
async function safeUnlink(filePath) {
  if (!filePath) return;
  await fs.unlink(filePath).catch(() => {});
}

/**
 * Upload nhiều file từ local → Cloudinary → xoá local
 */
async function uploadFiles(files, folder, context = "unknown") {
  if (!files || files.length === 0) return [];

  const uploaded = [];
  try {
    for (const file of files) {
      const result = await uploadToCloudinary(file.path, folder);
      uploaded.push({
        url: result.secure_url,
        public_id: result.public_id,
      });
      await safeUnlink(file.path);
    }
    if (uploaded.length > 0) uploaded[0].is_primary = true;
    return uploaded;
  } catch (err) {
    // nếu lỗi thì xoá hết file local
    for (const file of files) await safeUnlink(file.path);
    console.error(`[${context}] Upload files failed:`, err);
    throw new Error(`[${context}] Upload files failed`);
  }
}

/**
 * Thay thế file cũ bằng file mới
 */
async function replaceFile(oldPublicId, newFile, folder, context = "unknown", keepPrimary = false) {
  if (oldPublicId) await deleteFromCloudinary(oldPublicId);
  if (!newFile) return null;

  const uploaded = await uploadFiles([newFile], folder, context);
  if (uploaded.length === 0) return null;

  uploaded[0].is_primary = keepPrimary ? true : uploaded[0].is_primary;
  return uploaded[0];
}

/**
 * Xoá nhiều file trên Cloudinary
 */
async function deleteFiles(publicIds = []) {
  for (const id of publicIds) {
    try {
      await deleteFromCloudinary(id);
    } catch (err) {
      console.error(`Failed to delete Cloudinary file ${id}`, err);
    }
  }
}

module.exports = {
  uploadFiles,
  replaceFile,
  deleteFiles,
};
