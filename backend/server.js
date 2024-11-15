const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require('cors');

const app = express();
const PORT = 3001;
const DATA_FOLDER = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_FOLDER, "statusData.json");

app.use(cors());

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "../config.json"), "utf-8"));

if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

let statuses = loadStatusData();

function loadStatusData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (err) {
      console.error("Error reading status data file", err);
      return initializeStatusData();
    }
  } else {
    return initializeStatusData();
  }
}

function initializeStatusData() {
  return config.services.map((service) => ({
    ...service,
    pingInterval: service.pingInterval * 1000,
    history: Array(90).fill(null),
    lastPing: Date.now(),
    lastStatus: null,
  }));
}

function saveStatusData(stats) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(stats, null, 2));
  } catch (err) {
    console.error("Error saving status data", err);
  }
}

async function pingService(service) {
  try {
    let isOnline = false;
    if (service.address.startsWith("http")) {
      const response = await axios.get(service.address, { timeout: 5000 });
      isOnline = response.status === 200;
    } else {
      const response = await axios.get(`http://localhost:${PORT}/api/ping?address=${service.address}`);
      isOnline = response.data.alive;
    }
    return isOnline;
  } catch {
    return false;
  }
}

function getDayIndex(lastPingTime) {
  const now = Date.now();
  const dayInMillis = 1000 * 60 * 60 * 24;
  const daysAgo = Math.floor((now - lastPingTime) / dayInMillis);
  return (daysAgo % 90);
}

async function updateStatuses() {
  const now = Date.now();
  const updatedStatuses = await Promise.all(
    statuses.map(async (service) => {
      if (now - service.lastPing >= service.pingInterval) {
        const isOnline = await pingService(service);
        
        const dayIndex = getDayIndex(service.lastPing);
        
        service.history[dayIndex] = isOnline;

        service.lastPing = Date.now();
        service.lastStatus = isOnline;
      }
      return service;
    })
  );

  statuses = updatedStatuses;
  saveStatusData(statuses);
}

setInterval(updateStatuses, 1000);

app.get("/api/status", (req, res) => {
  res.json({ title: config.configs.title, statuses });
});

app.get("/api/ping", async (req, res) => {
  const { address } = req.query;
  res.json({ alive: true });
});

app.listen(PORT, () => {
  console.log(" ");
  console.log("   _____ _        _   _      __           _   _             ");
  console.log("  / ____| |      | | (_)    / _|         | | (_)            ");
  console.log(" | (___ | |_ __ _| |_ _ ___| |_ __ _  ___| |_ _  ___  _ __  ");
  console.log("  \___ \| __/ _` | __| / __|  _/ _` |/ __| __| |/ _ \| '_ \ ");
  console.log("  ____) | || (_| | |_| \__ \ || (_| | (__| |_| | (_) | | | |");
  console.log(" |_____/ \__\__,_|\__|_|___/_| \__,_|\___|\__|_|\___/|_| |_|");
  console.log(" ");
  console.log(`Server running on port ${PORT}`);
});