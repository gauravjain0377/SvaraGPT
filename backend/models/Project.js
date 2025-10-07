import mongoose from "mongoose";

const ProjectChatSchema = new mongoose.Schema({
    threadId: { type: String, required: true },
    title: { type: String, required: true }
}, { _id: false });

const ProjectSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    chats: { type: [ProjectChatSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Project", ProjectSchema);


