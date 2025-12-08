import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import session from "express-session";
import MongoStore from "connect-mongo";
import chatRoutes from "./routes/chat.js";
import projectRoutes from "./routes/project.js";
import authRoutes from "./routes/auth.js";
import migrateRoutes from "./routes/migrate.js";
import contactRoutes from "./routes/contact.js";
import passportConfig from "./config/passport.js";

// Set NODE_ENV to 'production' if not set
if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL ? 'production' : 'development';
}

const app = express();
const PORT = process.env.PORT || 8080;

// MongoDB Connection Management for Serverless
let isConnected = false;

const connectDB = async () => {
    if (isConnected) {
        console.log("📦 Using existing MongoDB connection");
        return;
    }

    try {
        console.log("🔄 Connecting to MongoDB...");
        console.log("📍 MongoDB URL:", process.env.MONGODB_URL ? "SET" : "NOT SET");
        
        const options = {
            dbName: process.env.MONGODB_DB_NAME || "SvaraGPT_Database",
            serverSelectionTimeoutMS: 10000, // Timeout after 10s instead of 30s
            socketTimeoutMS: 45000,
            maxPoolSize: 10, // Maintain up to 10 socket connections
            minPoolSize: 1,
            maxIdleTimeMS: 10000,
        };

        await mongoose.connect(process.env.MONGODB_URL, options);
        
        isConnected = true;
        console.log("✅ Connected to MongoDB successfully!");
        console.log("📊 Database:", mongoose.connection.db.databaseName);
    } catch (err) {
        console.error("❌ MongoDB connection error:", err.message);
        console.error("❌ Full error:", err);
        isConnected = false;
        throw err;
    }
};

// Handle MongoDB connection events
mongoose.connection.on('connected', () => {
    console.log('✅ Mongoose connected to MongoDB');
    isConnected = true;
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Mongoose connection error:', err);
    isConnected = false;
});

mongoose.connection.on('disconnected', () => {
    console.log('⚠️  Mongoose disconnected from MongoDB');
    isConnected = false;
});

// Connect to MongoDB immediately (critical for serverless)
await connectDB();

const normalizeOrigin = (value) => {
    if (!value || typeof value !== "string") return null;
    return value.replace(/\/$/, "");
};

const defaultAllowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    normalizeOrigin(process.env.FRONTEND_URL),
    "https://svaragpt.vercel.app"
];

const envAllowedOrigins = [
    normalizeOrigin(process.env.FRONTEND_URL),
    normalizeOrigin(process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`),
    normalizeOrigin(process.env.RENDER_EXTERNAL_URL && `https://${process.env.RENDER_EXTERNAL_URL}`),
    normalizeOrigin(process.env.VERCEL_ALLOWED_ORIGINS)
]
    .flatMap((origin) => {
        if (!origin) return [];
        return origin.split(",").map((item) => normalizeOrigin(item.trim())).filter(Boolean);
    })
    .filter(Boolean);

const extraAllowedOrigins = [
    "https://svaragpt.onrender.com",
    "https://svaragpt.vercel.app"
];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins, ...extraAllowedOrigins].filter(Boolean))];

// Log allowed origins for debugging
console.log("🌐 Allowed CORS origins:", allowedOrigins);

app.set("trust proxy", 1);
app.use(express.json());
app.use(cors({
    origin: (origin, callback) => {
        const normalizedOrigin = normalizeOrigin(origin);
        // Allow non-browser requests or same-originless (like curl) and SSR prefetch
        if (!origin) {
            console.log("⚠️  Request with no origin (non-browser or SSR)");
            return callback(null, true);
        }
        if (normalizedOrigin && allowedOrigins.includes(normalizedOrigin)) {
            console.log(`✅ CORS allowed for: ${origin}`);
            return callback(null, true);
        }
        console.log(`❌ CORS blocked for: ${origin}`);
        console.log(`   Normalized: ${normalizedOrigin}`);
        console.log(`   Allowed origins: ${allowedOrigins.join(", ")}`);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Set-Cookie']
}));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "your-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URL,
        ttl: 24 * 60 * 60, // 1 day
        autoRemove: 'native',
        touchAfter: 24 * 3600, // time period in seconds
        serialize: (obj) => {
            return JSON.stringify(obj)
        },
        unserialize: (str) => {
            return JSON.parse(str)
        }
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Use secure in production (HTTPS required)
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Use 'none' in production for cross-domain
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        path: '/'
        // Don't set domain - let browser handle it automatically for cross-origin requests
    },
    proxy: true // Required when behind a proxy like Render
}));
app.use(passportConfig.initialize());
app.use(passportConfig.session());

// Root route handler
app.get("/", (req, res) => {
    res.send({
        message: "SvaraGPT API is running",
        status: "online",
        documentation: "API documentation coming soon"
    });
});

app.use("/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", projectRoutes);
app.use("/api/migrate", migrateRoutes);
app.use("/api", contactRoutes);

// For local development, start the server
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

// Export for Vercel serverless
export default app;




// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// app.post("/test", async (req, res) => {
//   try {
//     const message = req.body?.message;
//     if (!message) return res.status(400).json({ error: "Missing 'message'" });

//     const result = await model.generateContent(message);
//     const text = result?.response?.text?.() || "No response generated";
//     res.send(text);
//   } catch (err) {
//     console.error("Gemini API error:", err.message);
//     res.status(500).json({ error: "Failed to generate content", details: err.message });
//   }
// });

// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => console.log(`Server running on port ${PORT}`));






// import { GoogleGenerativeAI } from "@google/generative-ai";
// import "dotenv/config";

// // Initialize Google Generative AI client with your API key
// const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// async function run() {
//   try {
//     console.log("🤖 Testing Google Gemini API...");
    
//     // Select the Gemini model (using the most reliable free model)
//     const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    
//     // Send a prompt
//     const result = await model.generateContent("Tell me a joke related to Computer Science");
    
//     // Get the response text
//     const response = result.response.text();
    
//     // Print the output text
//     console.log("\n✅ SUCCESS! Generated content:");
//     console.log(response);
    
//   } catch (error) {
//     console.error("❌ Error:", error.message);
    
//     if (error.message.includes('429') || error.message.includes('quota')) {
//       console.log("\n⚠️  Quota exceeded - your API key is working, just hit the free tier limits!");
//       console.log("💡 Try again in a few minutes or hours.");
//     } else if (error.message.includes('404')) {
//       console.log("\n⚠️  Model not found - trying backup model...");
      
//       // Try backup model
//       try {
//         const backupModel = genAI.getGenerativeModel({ model: "gemini-pro" });
//         const backupResult = await backupModel.generateContent("Generate a joke related to information technology");
//         const backupResponse = backupResult.response.text();
        
//         console.log("✅ SUCCESS with backup model!");
//         console.log(backupResponse);
//       } catch (backupError) {
//         console.log("❌ Backup model also failed:", backupError.message);
//       }
//     }
//   }
// }

// // Run the function
// run();