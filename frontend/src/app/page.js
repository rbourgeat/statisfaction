"use client";

import { useEffect, useState } from "react";
import axios from "axios";

export default function Home() {
  const [statuses, setStatuses] = useState([]);
  const [title, setTitle] = useState("Status Page");
  const [historyDays, setHistoryDays] = useState(90);

  useEffect(() => {
    const loadConfig = async () => {
      const response = await fetch("/config.json");
      const data = await response.json();

      setTitle(data.configs.title);

      setStatuses(
        data.services.map((service) => ({
          name: service.name,
          address: service.address,
          pingInterval: service.pingInterval * 1000,
          showIp: service.showIp,
          history: Array(historyDays).fill(null),
          lastPing: Date.now(),
          lastStatus: null,
        }))
      );
    };
    loadConfig();
  }, []);

  const pingAddress = async (status) => {
    try {
      let isOnline = false;

      if (status.address.startsWith("http")) {
        const response = await axios.get(status.address, {
          timeout: 5000,
        });
        isOnline = response.status === 200;
      } else {
        const response = await axios.get(`/api/ping?address=${status.address}`);
        isOnline = response.data.alive;
      }

      return {
        ...status,
        lastPing: Date.now(),
        lastStatus: isOnline,
      };
    } catch {
      return {
        ...status,
        lastPing: Date.now(),
        lastStatus: false,
      };
    }
  };

  const updateHistory = (status) => {
    const dayIndex = Math.floor((Date.now() - status.lastPing) / (1000 * 60 * 60 * 24));

    const newHistory = [...status.history];
    newHistory[dayIndex] = status.lastStatus;

    return {
      ...status,
      history: newHistory.slice(0, historyDays),
    };
  };

  useEffect(() => {
    const checkStatus = async () => {
      const now = Date.now();
      const newStatuses = await Promise.all(
        statuses.map((status) => {
          if (now - status.lastPing >= status.pingInterval) {
            return pingAddress(status).then(updateHistory);
          }
          return status;
        })
      );

      setStatuses(newStatuses);
    };

    checkStatus();
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, [statuses, historyDays]);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative z-10 p-8">
        <h1 className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-white mb-8">
          {title}
        </h1>
        <div className="space-y-8">
          {statuses.map((status, index) => (
            <div key={index} className="relative p-6">
              <div
                className={`absolute inset-0 rounded-lg ${
                  status.lastStatus === null
                    ? "bg-gray-500"
                    : status.lastStatus
                    ? "bg-gradient-to-l from-green-400 to-green-800"
                    : "bg-gradient-to-l from-red-400 to-red-800"
                } z-0 scale-x-90 scale-y-50 skew-y-5 origin-right	-translate-x-10`}
              ></div>

              <div className="relative p-6 bg-white bg-opacity-10 backdrop-blur-xl rounded-lg shadow-lg z-10">
                <div className="absolute top-0 right-0 p-2 text-sm text-gray-400">
                  Ping every {status.pingInterval / 1000} seconds
                </div>
                <h2 className="text-2xl font-semibold text-white">{status.name}</h2>
                {status.showIp && <p className="text-md text-gray-300">{status.address}</p>}
                <div className="mt-4 flex space-x-1">
                  {status.history.map((isOnline, idx) => (
                    <div
                      key={idx}
                      className={`w-1 h-8 rounded-md shadow-lg ${
                        isOnline === null
                          ? "bg-gray-500"
                          : isOnline
                          ? "bg-gradient-to-b from-green-400 to-green-700"
                          : "bg-gradient-to-b from-red-400 to-red-700"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}