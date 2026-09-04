import mongoose from "mongoose";

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URL);
        console.log("Database Connected");
    } catch (error) {
        // BUG FIX: was using normal quotes "..." instead of backticks `...`
        // so ${error} never got interpolated, it printed literally.
        console.log(`Database Error: ${error}`);
    }
};

export default connectDb;