const { findUserBySessionToken } = require("../db");

function readBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) return "";
    return authHeader.slice(7).trim();
}

function requireAuth(req, res, next) {
    const token = readBearerToken(req);
    const user = findUserBySessionToken(token);

    if (!user) {
        return res.status(401).json({ error: "Not logged in." });
    }

    req.user = user;
    next();
}

module.exports = {
    readBearerToken,
    requireAuth
};
