import express from "express";
import "dotenv/config";
import cors from "cors";

const app = express();
const PORT = 8080;

app.use(express.json());
app.use(cors());


app.listen(PORT, () => {
    console.log(`server running on ${PORT}`);
 
});










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
//     const result = await model.generateContent("Meaning of gaurav");
    
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
