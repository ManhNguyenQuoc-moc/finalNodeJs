const mongoose = require("mongoose");

/**
 * Helper chạy transaction MongoDB
 * @param {function} taskFn - function nhận session và thực hiện các thao tác DB
 * @returns {any} kết quả của taskFn
 */
async function handleTransaction(taskFn) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await taskFn(session);
    await session.commitTransaction();
    session.endSession();
    return result;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

module.exports = {
  handleTransaction,
};
