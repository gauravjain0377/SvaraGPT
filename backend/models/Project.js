import mongoose from "mongoose";

const ProjectChatSchema = new mongoose.Schema({
    threadId: { type: String, required: true },
    title: { type: String, required: true },
    projectId: { type: String, required: true },
    isShared: { type: Boolean, default: false },
    lastModified: { type: Date, default: Date.now }
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    chats: { type: [ProjectChatSchema], default: [] },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt timestamp before saving
ProjectSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

export default mongoose.model("Project", ProjectSchema);


