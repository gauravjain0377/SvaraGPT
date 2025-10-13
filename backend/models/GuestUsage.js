import mongoose from 'mongoose';

const guestUsageSchema = new mongoose.Schema({
    guestId: {
        type: String,
        required: true,
        unique: true
    },
    totalMessages: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const GuestUsage = mongoose.model('GuestUsage', guestUsageSchema);

export default GuestUsage;