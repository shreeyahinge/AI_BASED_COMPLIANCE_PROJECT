const mongoose = require("mongoose");

const connectDB = async () => {
  const primaryUri = process.env.MONGO_URI;
  const fallbackUri = "mongodb://127.0.0.1:27017/smartbin";

  try {
    const conn = await mongoose.connect(primaryUri, { serverSelectionTimeoutMS: 2000 });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (primaryError) {
    console.warn(`Primary MongoDB Atlas Connection Failed (${primaryError.message}). Trying local MongoDB fallback...`);
    try {
      const conn = await mongoose.connect(fallbackUri, { serverSelectionTimeoutMS: 3000 });
      console.log(`Local MongoDB Fallback Connected: ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`Error connecting to MongoDB: ${fallbackError.message}`);
      process.exit(1);
    }
  }
};

module.exports = connectDB;