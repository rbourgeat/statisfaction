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
        const { data: issueData } = await gitClient.issues.get({
          owner: repoOwner,
          repo: repoName,
          issue_number: issueNumber,
        });

        const { data: commentsData } = await gitClient.issues.listComments({
          owner: repoOwner,
          repo: repoName,
          issue_number: issueNumber,
        });

        incidents.push({
          title: issueData.title,
          createdAt: issueData.created_at,
          issueUrl: issueData.html_url,
          comments: commentsData.map((comment) => ({
            body: comment.body,
            createdAt: comment.created_at,
            author: comment.user.login,
          })),
        });
      }
    } else if (config.repository.platform === "gitlab") {
      const projectId = encodeURIComponent(`${repoOwner}/${repoName}`);
      for (const issueNumber of issueNumbers) {
        try {
          const { data: issueData } = await axios.get(
            `https://gitlab.com/api/v4/projects/${projectId}/issues/${issueNumber}`,
            {
              headers: { Authorization: `Bearer ${config.repository.authToken}` },
            }
          );

          const { data: commentsData } = await axios.get(
            `https://gitlab.com/api/v4/projects/${projectId}/issues/${issueNumber}/notes`,
            {
              headers: { Authorization: `Bearer ${config.repository.authToken}` },
            }
          );

          const userComments = commentsData.filter((comment) => !comment.system);
          userComments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

          incidents.push({
            title: issueData.title,
            createdAt: issueData.created_at,
            issueUrl: issueData.web_url,
            comments: userComments.map((comment) => ({
              body: comment.body,
              createdAt: comment.created_at,
              author: comment.author.name,
            })),
          });
        } catch (error) {
          console.error(
            `Failed to fetch incident for issue #${issueNumber} on GitLab:`,
            error.message
          );
        }
      }
    }
    return incidents;
  } catch (error) {
    console.error("Error fetching incidents:", error.message);
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
    const startTime = Date.now();

    if (service.address.startsWith("http")) {
      const expectedStatusCode = service.expectedStatusCode || 200;
      const response = await axios.get(service.address, { timeout: 5000 });

      const responseTime = Date.now() - startTime;
      return { isOnline: response.status === expectedStatusCode, responseTime };
    } else {
      const res = await ping.promise.probe(service.address, {
        timeout: 5,
      });

      const responseTime = res.time ? parseInt(res.time) : null;
      return { isOnline: res.alive, responseTime };
    }
  } catch (error) {
    console.error(`Error pinging ${service.address}: ${error.message}`);
    return { isOnline: false, responseTime: null };
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
        const { isOnline, responseTime } = await pingService(service);

        if (!isOnline) {
          if (!service.downtimeStart) {
            service.downtimeStart = now;
          }

          const downtimeDuration = (now - service.downtimeStart) / 1000;

          if (
            downtimeDuration >= incidentReportDelay &&
            !service.incidentReported
          ) {
            service.incidentReported = true;

            console.log(
              `Service "${service.name}" is down for ${downtimeDuration} seconds. Creating incident...`
            );

            try {
              await createIncident(
                service.name,
                `The service "${service.name}" has been down since **${new Date(service.downtimeStart).getDate()} \
                ${new Date(service.downtimeStart).toLocaleString('default', { month: 'short' })} \
                ${new Date(service.downtimeStart).getFullYear()} \
                ${new Date(service.downtimeStart).toLocaleString("en-GB", {hour: "2-digit", minute: "2-digit", hour12: false,}).replace(",", "").replace(":", "h")}** \
                (Downtime: ${downtimeDuration} seconds).`
              );
            } catch (error) {
              console.error("Failed to report incident:", error.message);
              service.incidentReported = false;
            }
          }
        } else {
          service.downtimeStart = null;
          service.incidentReported = false;
        }

        service.lastPing = now;
        service.lastStatus = isOnline;
        service.responseTime = responseTime;

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
  const { platform, owner, repo, authToken, assignee } = config.repository;
  const apiBase =
    platform === "github"
      ? `https://api.github.com/repos/${owner}/${repo}/issues`
      : `https://gitlab.com/api/v4/projects/${encodeURIComponent(`${owner}/${repo}`)}/issues`;

  const assignees = assignee.split(',').map((a) => a.trim()).filter(Boolean);

  const today = getCurrentDay();
  const service = statuses.find((s) => s.name === serviceName);
  if (!service) {
    console.error(`Service "${serviceName}" not found.`);
    return;
  }

  const existingIssue = service.dailyHistory.find(
    (entry) => entry.date === today && entry.issueNumber
  );

  if (existingIssue) {
    console.log(
      `An incident for "${serviceName}" has already been created today (Issue #${existingIssue.issueNumber}).`
    );
    return;
  }

  try {
    console.log(`Attempting to create incident for "${serviceName}" on ${platform}.`);

    let issueData;
    if (platform === "github") {
      issueData = {
        title: `Incident: ${serviceName}`,
        body: description,
        assignees,
      };
    } else if (platform === "gitlab") {
      const userPromises = assignees.map(async (assignee) => {
        try {
          const { data } = await axios.get(
            `https://gitlab.com/api/v4/users`,
            {
              params: { username: assignee },
              headers: {
                Authorization: `Bearer ${authToken}`,
              },
            }
          );
          return data.length > 0 ? data[0].id : null;
        } catch (error) {
          console.error(`Failed to fetch user ID for "${assignee}":`, error.message);
          return null;
        }
      });

      const userIds = (await Promise.all(userPromises)).filter((id) => id !== null);

      issueData = {
        title: `Incident: ${serviceName}`,
        description,
        assignee_ids: userIds,
      };
    } else {
      throw new Error(`Unsupported platform: ${platform}`);
    }

    const response = await axios.post(apiBase, issueData, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    const issueNumber =
      platform === "github" ? response.data.number : response.data.iid;

    const todayEntry = service.dailyHistory.find((entry) => entry.date === today);
    if (todayEntry) {
      todayEntry.issueNumber = issueNumber;
    } else {
      service.dailyHistory.push({
        date: today,
        uptime: 0,
        downtimeHours: 0,
        issueNumber,
      });
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
    saveStatusData(statuses);
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
  const optimizedStatuses = statuses.map((service) => {
    const { showIp, address, responseTime, dailyHistory, ...rest } = service;

    const optimizedDailyHistory = dailyHistory.slice(-90);

    return showIp
      ? { ...rest, address, responseTime, dailyHistory: optimizedDailyHistory }
      : { ...rest, responseTime, dailyHistory: optimizedDailyHistory };
  });

  res.json({
    title: config.configs.title,
    description: config.configs.description,
    statuses: optimizedStatuses,
  });
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
