import mongoose from 'mongoose';

require('dotenv').config();

const MONGO_URI: string = process.env.MONGO_URI || 'mongodb+srv://nihadmammadli95:Z0k1KYlyvHBtngj2@cluster0.ly4rw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log(MONGO_URI);

export const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('MongoDB connected');
    } catch (err) {
        console.error(err);
    }
};
