import { fileURLToPath } from 'url';
import express from 'express';
import axios from 'axios';
import path from 'path';
import ping from 'ping';
import cors from 'cors';
import fs from 'fs';

import { Octokit } from '@octokit/rest';
import { Gitlab } from 'gitlab';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
const PORT = 3001;
const DATA_FOLDER = path.join(__dirname, "../data");
const DATA_FILE = path.join(DATA_FOLDER, "statusData.json");
const CONFIG_FILE = path.join(__dirname, "../config.json");

app.use(cors());

if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

let config = loadConfig();

function loadConfig() {
  try {
    const newConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    return newConfig;
  } catch (err) {
    console.error("Error reading config file:", err.message);
    return { configs: { title: "Status Page" }, services: [] };
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
    incidentReported: false,
  }));
}

function loadStatusData() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      const loadedData = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      return loadedData.map((service) => ({
        ...service,
        dailyHistory: service.dailyHistory || [],
        currentDayPings: service.currentDayPings || { online: 0, total: 0 },
        incidentReported: service.incidentReported || false,
      }));
    } catch (err) {
      console.error("Error reading status data file:", err.message);
      return initializeStatusData();
    }
  } else {
    return initializeStatusData();
  }
}

let statuses = loadStatusData();

let gitClient;

function initGitClient() {
  const repoConfig = config.repository;
  
  if (repoConfig && repoConfig.authToken) {
    if (repoConfig.platform === 'github') {
      gitClient = new Octokit({ auth: repoConfig.authToken });
      console.log('GitHub client initialized');
    } else if (repoConfig.platform === 'gitlab') {
      gitClient = new Gitlab({ token: repoConfig.authToken });
      console.log('GitLab client initialized');
    } else {
      console.error('Unsupported platform:', repoConfig.platform);
    }
  } else {
    console.error('No repository authentication token provided in the config.');
  }
}

initGitClient();

function getCurrentMonth() {
  const now = new Date();
  return now.toISOString().slice(0, 7);
}

async function fetchPastIncidents() {
  const repoOwner = config.repository.owner;
  const repoName = config.repository.repo;

  const issueNumbers = statuses.flatMap((service) =>
    service.dailyHistory.map((entry) => entry.issueNumber).filter(Boolean)
  );

  if (issueNumbers.length === 0) return [];

  try {
    const incidents = [];
    if (config.repository.platform === "github") {
      for (const issueNumber of issueNumbers) {
        const { data } = await gitClient.issues.get({
          owner: repoOwner,
          repo: repoName,
          issue_number: issueNumber,
        });
        incidents.push({
          title: data.title,
          createdAt: data.created_at,
          issueUrl: data.html_url,
        });
      }
    } else if (config.repository.platform === "gitlab") {
      for (const issueNumber of issueNumbers) {
        const projectId = encodeURIComponent(`${repoOwner}/${repoName}`);
        const data = await gitClient.Issues.show(projectId, issueNumber);
        incidents.push({
          title: data.title,
          createdAt: data.created_at,
          issueUrl: data.web_url,
        });
      }
    }
    return incidents;
  } catch (error) {
    console.error("Error fetching incidents:", error.message);
    return [];
  }
}

function filterIncidentsByMonth(issues) {
  const currentMonth = getCurrentMonth();
  return issues
    .filter((issue) => issue.created_at.startsWith(currentMonth))
    .map((issue) => ({
      title: issue.title,
      createdAt: issue.created_at,
      commentsUrl: issue.comments_url || issue._links.notes,
    }));
}

async function fetchIncidentComments(commentsUrl) {
  try {
    if (config.configs.githubToken) {
      const { data } = await axios.get(commentsUrl, {
        headers: { Authorization: `token ${config.configs.githubToken}` },
      });
      return data.map((comment) => ({
        body: comment.body,
        createdAt: comment.created_at,
      }));
    } else if (config.configs.gitlabToken) {
      const { data } = await axios.get(commentsUrl, {
        headers: { "Private-Token": config.configs.gitlabToken },
      });
      return data.map((note) => ({
        body: note.body,
        createdAt: note.created_at,
      }));
    }
  } catch (error) {
    console.error("Error fetching comments:", error.message);
    return [];
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

function saveStatusData(stats) {
  try {
    const today = getCurrentDay();

    stats.forEach((service) => {
      const todayIndex = service.dailyHistory.findIndex(
        (entry) => entry.date === today
      );

      const uptime =
        (service.currentDayPings.online / service.currentDayPings.total) * 100 || 0;
      const downtimeHours =
        ((service.currentDayPings.total - service.currentDayPings.online) *
          (service.pingInterval / 1000)) /
        3600;

      const todayData = {
        date: today,
        uptime,
        downtimeHours,
        issueNumber: service.dailyHistory[todayIndex]?.issueNumber || null,
      };

      if (todayIndex >= 0) {
        service.dailyHistory[todayIndex] = todayData;
      } else {
        service.dailyHistory.push(todayData);
      }

      service.dailyHistory = service.dailyHistory.slice(-90);
    });

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
  const { incidentReportDelay } = config.configs;

  const updatedStatuses = await Promise.all(
    statuses.map(async (service) => {
      if (now - service.lastPing >= service.pingInterval) {
        const isOnline = await pingService(service);

        if (!isOnline) {
          if (!service.downtimeStart) {
            service.downtimeStart = now;
          }

          const downtimeDuration = (now - service.downtimeStart) / 1000;

          if (
            downtimeDuration >= incidentReportDelay &&
            !service.incidentReported
          ) {
            console.log(
              `Service "${service.name}" is down for ${downtimeDuration} seconds. Creating incident...`
            );

            try {
              await createIncident(
                service.name,
                `The service "${service.name}" has been down since ${new Date(
                  service.downtimeStart
                ).toISOString()} (Downtime: ${downtimeDuration} seconds).`
              );
              service.incidentReported = true;
            } catch (error) {
              console.error("Failed to report incident:", error.message);
            }
          }
        } else {
          service.downtimeStart = null;
          service.incidentReported = false;
        }

        service.lastPing = now;
        service.lastStatus = isOnline;

        service.currentDayPings.total += 1;
        if (isOnline) service.currentDayPings.online += 1;
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

async function createIncident(serviceName, description) {
  const { platform, owner, repo, authToken } = config.repository;
  const apiBase =
    platform === "github"
      ? `https://api.github.com/repos/${owner}/${repo}/issues`
      : `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}/issues`;

  try {
    console.log(`Attempting to create incident for "${serviceName}" on ${platform}.`);
    const issueData =
      platform === "github"
        ? { title: `Incident: ${serviceName}`, body: description }
        : { title: `Incident: ${serviceName}`, description };

    const response = await axios.post(apiBase, issueData, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    const issueNumber =
      platform === "github" ? response.data.number : response.data.iid;

    const today = getCurrentDay();
    const service = statuses.find((s) => s.name === serviceName);
    if (service) {
      const todayEntry = service.dailyHistory.find((entry) => entry.date === today);
      if (todayEntry) {
        todayEntry.issueNumber = issueNumber;
      } else {
        service.dailyHistory.push({ date: today, uptime: 0, downtimeHours: 0, issueNumber });
      }
    }

    saveStatusData(statuses);
    console.log(`Incident created successfully:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`Failed to create incident for "${serviceName}":`, error.message);
    throw error;
  }
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

app.get("/api/incidents", async (req, res) => {
  const incidents = await fetchPastIncidents();

  res.json({ incidents: incidents });
});

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
