import express from "express";
import "dotenv/config";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import session from "express-session";
import chatRoutes from "./routes/chat.js";
import projectRoutes from "./routes/project.js";
import authRoutes from "./routes/auth.js";
import migrateRoutes from "./routes/migrate.js";
import contactRoutes from "./routes/contact.js";
import passportConfig from "./config/passport.js";

const app = express();
const PORT = 8080;

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
    "https://svaragpt.onrender.com"
];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...envAllowedOrigins, ...extraAllowedOrigins].filter(Boolean))];

console.log("[CORS] Allowed origins:", allowedOrigins);

app.set("trust proxy", 1);
app.use(express.json());
app.use(cors({
    origin: (origin, callback) => {
        const normalizedOrigin = normalizeOrigin(origin);
        if (!origin || (normalizedOrigin && allowedOrigins.includes(normalizedOrigin))) {
            console.log(`[CORS] Allowed request from origin: ${origin ?? "<no-origin>"}`);
            return callback(null, origin);
        }
        console.warn(`[CORS] Blocked origin: ${origin}`);
        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true
}));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || "your-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
}));
app.use(passportConfig.initialize());
app.use(passportConfig.session());

app.use("/auth", authRoutes);
app.use("/api", chatRoutes);
app.use("/api", projectRoutes);
app.use("/api/migrate", migrateRoutes);
app.use("/api", contactRoutes);

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    connectDB();
});

const connectDB = async() => {
    try {
        await mongoose.connect(process.env.MONGODB_URL, {
            dbName: process.env.MONGODB_DB_NAME || "SvaraGPT_Database"
        });
        console.log("Connected with Database!");
    } catch(err) {
        console.log("Failed to connect with Db", err);
    }
}




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
