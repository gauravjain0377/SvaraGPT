import geoip from "geoip-lite";

/**
 * Get geolocation information from IP address using ipapi.co API
 * Falls back to geoip-lite if API fails
 */
export async function getGeolocation(ip) {
    // Default response
    const defaultGeo = {
        country: "Unknown",
        countryCode: "XX",
        city: "Unknown",
        region: "",
        timezone: "",
        latitude: null,
        longitude: null
    };

    // Skip localhost IPs and private networks
    if (!ip || ip === "unknown" || ip.includes("::1") || ip.includes("127.0.0.1") || ip.startsWith("192.168.") || ip.startsWith("10.")) {
        console.log(`ℹ️ [geolocation] Skipping local/private IP: ${ip}`);
        return defaultGeo;
    }

    console.log(`🌍 [geolocation] Looking up IP: ${ip}`);

    try {
        // Try ipapi.co first (free tier: 1000 requests/day)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`https://ipapi.co/${ip}/json/`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            
            if (data.error) {
                console.warn(`⚠️ ipapi.co error for ${ip}:`, data.reason);
                return fallbackToGeoipLite(ip);
            }

            const geoData = {
                country: data.country_name || "Unknown",
                countryCode: data.country_code || "XX",
                city: data.city || "Unknown",
                region: data.region || "",
                timezone: data.timezone || "",
                latitude: data.latitude || null,
                longitude: data.longitude || null
            };
            
            console.log(`✅ [geolocation] ipapi.co result for ${ip}:`, geoData);
            return geoData;
        }

        // If API fails, fallback to geoip-lite
        console.warn(`⚠️ ipapi.co HTTP error for ${ip}: ${response.status}`);
        return fallbackToGeoipLite(ip);
    } catch (error) {
        console.warn(`⚠️ Geolocation lookup failed for ${ip}:`, error.message);
        return fallbackToGeoipLite(ip);
    }
}

/**
 * Fallback to geoip-lite (offline database)
 */
function fallbackToGeoipLite(ip) {
    console.log(`📚 [geolocation] Trying geoip-lite fallback for ${ip}`);
    const geo = geoip.lookup(ip);
    
    if (geo) {
        const geoData = {
            country: geo.country || "Unknown",
            countryCode: geo.country || "XX",
            city: geo.city || "Unknown",
            region: geo.region || "",
            timezone: geo.timezone || "",
            latitude: geo.ll?.[0] || null,
            longitude: geo.ll?.[1] || null
        };
        console.log(`✅ [geolocation] geoip-lite result:`, geoData);
        return geoData;
    }

    console.log(`❌ [geolocation] No data found for ${ip}`);
    return {
        country: "Unknown",
        countryCode: "XX",
        city: "Unknown",
        region: "",
        timezone: "",
        latitude: null,
        longitude: null
    };
}

/**
 * Get country flag emoji from country code
 */
export function getCountryFlag(countryCode) {
    if (!countryCode || countryCode === "XX") {
        return "🌍"; // Globe emoji for unknown
    }

    // Convert country code to flag emoji
    // Example: US -> 🇺🇸
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    
    return String.fromCodePoint(...codePoints);
}
