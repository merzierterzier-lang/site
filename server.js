const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static("public"));

// Load data
let keys = JSON.parse(fs.readFileSync("./keys.json", "utf8"));
let users = JSON.parse(fs.readFileSync("./users.json", "utf8"));
let accounts = [];

// Load config
const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

function loadAccounts() {
    accounts = fs.readFileSync("./accounts.txt", "utf8").split("\n").filter(x => x.trim() !== "");
}

function saveAccounts() {
    fs.writeFileSync("./accounts.txt", accounts.join("\n"));
}

loadAccounts();

// ==============================
// API ROUTES
// ==============================

// LOGIN
app.post("/api/login", (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.json({ success: false, message: "Missing fields" });
    }

    const user = Object.values(users).find(u => u.username === username);

    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    if (user.password !== password) {
        return res.json({ success: false, message: "Invalid password" });
    }

    return res.json({ 
        success: true, 
        user: {
            id: Object.keys(users).find(k => users[k].username === username),
            username: user.username,
            type: user.type,
            expires: user.expires,
            key: user.key
        }
    });
});

// SIGNUP
app.post("/api/signup", (req, res) => {
    const { username, password, key } = req.body;

    if (!username || !password) {
        return res.json({ success: false, message: "Missing fields" });
    }

    // Check if username exists
    if (Object.values(users).some(u => u.username === username)) {
        return res.json({ success: false, message: "Username already taken" });
    }

    // Create user
    const userId = Date.now().toString();
    let keyType = "free";
    let expires = null;
    let keyUsed = null;

    // If key provided, activate it
    if (key && key !== "null") {
        if (!keys[key]) {
            return res.json({ success: false, message: "Invalid key" });
        }

        if (keys[key].used) {
            return res.json({ success: false, message: "Key already used" });
        }

        keyType = keys[key].type;
        keyUsed = key;

        if (keyType === "daily") expires = Date.now() + 86400000;
        else if (keyType === "weekly") expires = Date.now() + 604800000;
        else if (keyType === "monthly") expires = Date.now() + 2592000000;
        else if (keyType === "lifetime") expires = null;

        keys[key].used = true;
    }

    users[userId] = {
        username,
        password,
        type: keyType,
        expires,
        key: keyUsed
    };

    fs.writeFileSync("./keys.json", JSON.stringify(keys, null, 2));
    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));

    return res.json({
        success: true,
        user: {
            id: userId,
            username,
            type: keyType,
            expires,
            key: keyUsed
        }
    });
});

// Activate Key
app.post("/api/activate-key", (req, res) => {
    const { key, userId, hwid } = req.body;

    if (!key || !userId) {
        return res.json({ success: false, message: "Missing fields" });
    }

    if (!keys[key]) {
        return res.json({ success: false, message: "Invalid key" });
    }

    if (keys[key].used) {
        return res.json({ success: false, message: "Key already used" });
    }

    const user = users[userId];
    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    // Check if HWID is already registered to different device
    if (user.hwid && user.hwid !== hwid) {
        return res.json({ success: false, message: "HWID already registered to different device. Ask admin to reset." });
    }

    const type = keys[key].type;
    let expires = null;

    if (type === "daily") expires = Date.now() + 86400000;
    else if (type === "weekly") expires = Date.now() + 604800000;
    else if (type === "monthly") expires = Date.now() + 2592000000;
    else if (type === "lifetime") expires = null;

    user.type = type;
    user.expires = expires;
    user.key = key;
    user.hwid = hwid; // Register HWID

    keys[key].used = true;

    fs.writeFileSync("./keys.json", JSON.stringify(keys, null, 2));
    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));

    return res.json({
        success: true,
        message: `Key activated: ${type.toUpperCase()}`,
        type,
        expires
    });
});

// Get Account
app.post("/api/get-account", (req, res) => {
    const { userId } = req.body;

    if (!userId) {
        return res.json({ success: false, message: "Missing user ID" });
    }

    const user = users[userId];
    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    if (user.type !== "lifetime" && user.expires && user.expires < Date.now()) {
        return res.json({ success: false, message: "Subscription expired" });
    }

    if (!user.hwid) {
        return res.json({ success: false, message: "HWID not registered. Activate a key first." });
    }

    loadAccounts();
    if (accounts.length === 0) {
        return res.json({ success: false, message: "No accounts available" });
    }

    const account = accounts.shift();
    saveAccounts();

    return res.json({
        success: true,
        message: "Account generated successfully!",
        account
    });
});

// Admin: Generate Key
app.post("/api/admin/genkey", (req, res) => {
    const { adminPassword, type } = req.body;

    if (adminPassword !== config.adminPassword) {
        return res.json({ success: false, message: "Invalid admin password" });
    }

    if (!["daily", "weekly", "monthly", "lifetime"].includes(type)) {
        return res.json({ success: false, message: "Invalid key type" });
    }

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let key = "";
    for (let i = 0; i < 25; i++) key += chars[Math.floor(Math.random() * chars.length)];
    const finalKey = `${type.toUpperCase()}-${key}`;

    keys[finalKey] = { type, used: false };
    fs.writeFileSync("./keys.json", JSON.stringify(keys, null, 2));

    return res.json({
        success: true,
        message: "Key generated successfully!",
        key: finalKey
    });
});

// Admin: Reset HWID
app.post("/api/admin/reset-hwid", (req, res) => {
    const { adminPassword, userId } = req.body;

    if (adminPassword !== config.adminPassword) {
        return res.json({ success: false, message: "Invalid admin password" });
    }

    if (!userId) {
        return res.json({ success: false, message: "User ID required" });
    }

    const user = users[userId];
    if (!user) {
        return res.json({ success: false, message: "User not found" });
    }

    const oldHwid = user.hwid;
    const oldKey = user.key;

    // If the user had an associated key, mark it as unused so it can be re-activated
    if (oldKey && keys[oldKey]) {
        keys[oldKey].used = false;
    }

    // Reset user's HWID and clear assigned key / subscription state
    user.hwid = null;
    user.key = null;
    user.type = "free";
    user.expires = null;

    // Save both files
    fs.writeFileSync("./keys.json", JSON.stringify(keys, null, 2));
    fs.writeFileSync("./users.json", JSON.stringify(users, null, 2));

    return res.json({
        success: true,
        message: `HWID and key reset for user ${user.username}. Old HWID: ${oldHwid || 'None'} Old Key: ${oldKey || 'None'}`
    });
});

// Serve static files
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
