import express from "express";
import httpProxy from "http-proxy";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { createProxyServer } = httpProxy;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4173;
const proxy = createProxyServer();

// Serve static files
app.use(express.static(join(__dirname, "dist")));

// Proxy configuration
const proxyTarget = "http://127.0.0.1:54321";

// Proxy middleware
app.use("/rest/v1", (req, res) => {
  proxy.web(req, res, { target: `${proxyTarget}/rest/v1` });
});

app.use("/auth/v1", (req, res) => {
  proxy.web(req, res, { target: `${proxyTarget}/auth/v1` });
});

app.use("/realtime", (req, res) => {
  proxy.web(req, res, { target: `${proxyTarget}/realtime`, ws: true });
});

// Handle WebSocket upgrades
app.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head, { target: `${proxyTarget}/realtime` });
});

// Handle SPA routing
app.get("*", (req, res) => {
  res.sendFile(join(__dirname, "dist", "index.html"));
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\nServer running at:`);
  console.log(`- Local:   http://localhost:${PORT}`);
  console.log(`- Network: http://${getLocalIpAddress()}:${PORT}\n`);
});

// Get local IP address
function getLocalIpAddress() {
  const nets = require("os").networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}
