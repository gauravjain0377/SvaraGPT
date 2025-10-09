import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema({
    role: {
        type: String,
        enum: ["user", "assistant", "system"],
        required: true
    },
    content: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const ThreadSchema = new mongoose.Schema({
    threadId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    title: {
        type: String,
        default: "New Chat",
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        default: "",
        trim: true,
        maxlength: 1000
    },
    messages: [MessageSchema],
    projectIds: [{
        type: String,
        index: true
    }],
    isArchived: {
        type: Boolean,
        default: false,
        index: true
    },
    isPinned: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    createdBy: {
        type: String,
        default: "system"
    },
    lastMessageAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    tokenCount: {
        type: Number,
        default: 0
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    version: {
        type: Number,
        default: 1
    }
}, {
    timestamps: {
        createdAt: 'createdAt',
        updatedAt: 'updatedAt'
    },
    toJSON: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    },
    toObject: {
        virtuals: true,
        transform: function(doc, ret) {
            delete ret._id;
            delete ret.__v;
            return ret;
        }
    }
});

// Indexes for better query performance
ThreadSchema.index({ threadId: 1 });
ThreadSchema.index({ 'projectIds': 1 });
ThreadSchema.index({ isArchived: 1, isPinned: -1, lastMessageAt: -1 });
ThreadSchema.index({ title: 'text', 'messages.content': 'text' }, { weights: { title: 3, 'messages.content': 1 } });

// Pre-save hook to update timestamps and metadata
ThreadSchema.pre('save', function(next) {
    if (this.isModified('messages') && this.messages.length > 0) {
        this.lastMessageAt = this.messages[this.messages.length - 1].timestamp || new Date();
        // Update token count (simplified example)
        this.tokenCount = this.messages.reduce((total, msg) => 
            total + (msg.content ? Math.ceil(msg.content.length / 4) : 0), 0);
    }
    
    // Update version on each save
    if (this.isModified()) {
        this.version += 1;
    }
    
    next();
});

// Static method to find by project ID
ThreadSchema.statics.findByProject = function(projectId, options = {}) {
    const { skip = 0, limit = 50, sort = { lastMessageAt: -1 } } = options;
    return this.find({ projectIds: projectId })
        .sort(sort)
        .skip(parseInt(skip))
        .limit(parseInt(limit));
};

// Instance method to add to project
ThreadSchema.methods.addToProject = async function(projectId) {
    if (!this.projectIds.includes(projectId)) {
        this.projectIds.push(projectId);
        return this.save();
    }
    return this;
};

// Instance method to remove from project
ThreadSchema.methods.removeFromProject = async function(projectId) {
    this.projectIds = this.projectIds.filter(id => id !== projectId);
    return this.save();
};

// Virtual for message count
ThreadSchema.virtual('messageCount').get(function() {
    return this.messages.length;
});

// Text search index
ThreadSchema.index({
    title: 'text',
    'messages.content': 'text'
}, {
    weights: {
        title: 10,
        'messages.content': 5
    },
    name: 'thread_search'
});

export default mongoose.model("Thread", ThreadSchema);