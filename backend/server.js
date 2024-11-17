const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const ping = require("ping");

const app = express();
const PORT = 3001;
const DATA_FOLDER = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_FOLDER, "statusData.json");
const CONFIG_FILE = path.join(__dirname, "../config.json");

app.use(cors());

if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

let statuses = loadStatusData();
let config = loadConfig();

function loadConfig() {
  try {
    const newConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return newConfig;
  } catch (err) {
    console.error("Error reading config file:", err.message);
    return config || { configs: {}, services: [] };
  }
}

function mergeStatusData(existingStatuses, newServices) {
  const updatedStatuses = existingStatuses.map((service) => {
    const updatedService = newServices.find((s) => s.name === service.name);

    if (updatedService) {
      return {
        ...service,
        ...updatedService,
        pingInterval: updatedService.pingInterval * 1000,
      };
    }

    return service;
  });

  const newServicesToAdd = newServices.filter(
    (newService) => !existingStatuses.some((s) => s.name === newService.name)
  );

  const newStatusData = newServicesToAdd.map((service) => ({
    ...service,
    pingInterval: service.pingInterval * 1000,
    dailyHistory: [],
    currentDayPings: { online: 0, total: 0 },
    lastPing: Date.now(),
    lastStatus: null,
  }));

  return [...updatedStatuses, ...newStatusData];
}

function loadStatusData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const loadedData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      return loadedData.map((service) => ({
        ...service,
        dailyHistory: service.dailyHistory || [],
        currentDayPings: service.currentDayPings || { online: 0, total: 0 },
      }));
    } catch (err) {
      console.error("Error reading status data file:", err.message);
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
    dailyHistory: [],
    currentDayPings: { online: 0, total: 0 },
    lastPing: Date.now(),
    lastStatus: null,
  }));
}

function saveStatusData(stats) {
  try {
    const dataToSave = stats.map(({ currentDayPings, ...rest }) => rest);
    fs.writeFileSync(DATA_FILE, JSON.stringify(dataToSave, null, 2));
  } catch (err) {
    console.error("Error saving status data:", err.message);
  }
}

async function pingService(service) {
  try {
    if (service.address.startsWith("http")) {
      const response = await axios.get(service.address, { timeout: 5000 });
      return response.status === 200;
    } else {
      const res = await ping.promise.probe(service.address, {
        timeout: 5,
      });
      return res.alive;
    }
  } catch (error) {
    console.error(`Error pinging ${service.address}:`, error.message);
    return false;
  }
}

function getCurrentDay() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

async function updateStatuses() {
  const now = Date.now();
  const updatedStatuses = await Promise.all(
    statuses.map(async (service) => {
      if (now - service.lastPing >= service.pingInterval) {
        const isOnline = await pingService(service);

        const currentDay = getCurrentDay();
        let todayData = service.dailyHistory.find((day) => day.date === currentDay);

        if (!todayData) {
          todayData = {
            date: currentDay,
            uptime: 100,
            downtimeHours: 0,
          };
          service.dailyHistory.push(todayData);
        }

        service.currentDayPings.total += 1;
        if (!isOnline) {
          service.currentDayPings.online = service.currentDayPings.online || 0;
          const downtimeIncrement = service.pingInterval / (1000 * 60 * 60);
          todayData.downtimeHours += downtimeIncrement;
          todayData.uptime = Math.max(
            0,
            ((service.currentDayPings.online / service.currentDayPings.total) * 100).toFixed(2)
          );
        } else {
          service.currentDayPings.online += 1;
          todayData.uptime = Math.min(
            100,
            ((service.currentDayPings.online / service.currentDayPings.total) * 100).toFixed(2)
          );
        }

        service.lastPing = now;
        service.lastStatus = isOnline;
      }

      return service;
    })
  );

  statuses = updatedStatuses;

  saveStatusData(statuses);
}

function resetDailyPings() {
  const today = getCurrentDay();
  statuses.forEach((service) => {
    if (service.dailyHistory.length > 0) {
      const lastDay = service.dailyHistory[service.dailyHistory.length - 1];
      if (lastDay.date !== today) {
        service.currentDayPings = { online: 0, total: 0 };
      }
    }
  });
}

fs.watch(CONFIG_FILE, () => {
  try {
    const newConfig = loadConfig();
    statuses = mergeStatusData(statuses, newConfig.services);
    config = newConfig;
    console.log("Configuration reloaded successfully.");
  } catch (error) {
    console.error("Failed to reload configuration:", error.message);
  }
});

setInterval(resetDailyPings, 1000 * 60 * 60 * 24);

setInterval(updateStatuses, 1000);

app.get("/api/status", (req, res) => {
  res.json({ title: config.configs.title, statuses });
});

app.listen(PORT, () => {
  console.log(" ");
  console.log("   ▗▄▄▖▗▄▄▄▖▗▄▖▗▄▄▄▖▗▄▄▄▖ ▗▄▄▖▗▄▄▄▖ ▗▄▖  ▗▄▄▖▗▄▄▄▖▗▄▄▄▖ ▗▄▖ ▗▖  ▗▖");
  console.log("  ▐▌     █ ▐▌ ▐▌ █    █  ▐▌   ▐▌   ▐▌ ▐▌▐▌     █    █  ▐▌ ▐▌▐▛▚▖▐▌");
  console.log("   ▝▀▚▖  █ ▐▛▀▜▌ █    █   ▝▀▚▖▐▛▀▀▘▐▛▀▜▌▐▌     █    █  ▐▌ ▐▌▐▌ ▝▜▌");
  console.log("  ▗▄▄▞▘  █ ▐▌ ▐▌ █  ▗▄█▄▖▗▄▄▞▘▐▌   ▐▌ ▐▌▝▚▄▄▖  █  ▗▄█▄▖▝▚▄▞▘▐▌  ▐▌");
  console.log(" ");
  console.log(`Server running on port ${PORT}`);
});
