// config/db.js
const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    console.log(" Current MONGO_URI:", process.env.MONGO_URI);
    const uri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/finalnodejs";
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(" MongoDB connected:", uri);
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;
