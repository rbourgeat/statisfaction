"use client";

import { useEffect, useState } from "react";
import axios from "axios";


export default function Home() {
  const [statuses, setStatuses] = useState([]);
  const [title, setTitle] = useState("Status Page");
  const [incidents, setIncidents] = useState([]);

  const fetchStatusData = async () => {
    try {
      const response = await axios.get("http://localhost:3001/api/status");
      setTitle(response.data.title);
      setStatuses(response.data.statuses);
    } catch (error) {
      console.error("Error fetching status data:", error);
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await axios.get("http://localhost:3001/api/incidents");
      setIncidents(response.data.incidents);
    } catch (error) {
      console.error("Error fetching incidents:", error);
    }
  };

  useEffect(() => {
    fetchStatusData();
    fetchIncidents();
    const interval = setInterval(() => {
      fetchStatusData();
      fetchIncidents();
    }, 2000);
  
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="relative z-10 p-8">
        <h1 className="text-4xl font-extrabold text-center text-transparent bg-clip-text bg-white mb-8">
          {title}
        </h1>
        <div className="space-y-8">
          {statuses.map((status, index) => {
            const last90Days = status.dailyHistory || [];
            const today = new Date();

            const daysToDisplay = Array.from({ length: 90 }, (_, i) => {
              const date = new Date(today);
              date.setDate(today.getDate() - (89 - i));
              const formattedDate = date.toISOString().split("T")[0];

              const dayData = last90Days.find((day) => day.date === formattedDate);
              return (
                dayData || {
                  date: formattedDate,
                  uptime: null,
                  downtimeHours: null,
                }
              );
            });

            const averageUptime = (
              daysToDisplay.reduce(
                (sum, day) => sum + (day.uptime !== null ? day.uptime : 100),
                0
              ) / 90
            ).toFixed(2);

            return (
              <div key={index} className="relative p-6">
                <div
                  className={`absolute inset-0 rounded-lg ${
                    status.lastStatus === null
                      ? "bg-gray-500"
                      : status.lastStatus
                      ? "bg-green-500"
                      : "bg-red-500"
                  } z-0 scale-x-90 scale-y-50 origin-right -translate-x-10`}
                ></div>

                <div className="relative p-6 bg-white/10 backdrop-blur-xl rounded-lg shadow-xl z-10">
                  <div className={`absolute font-semibold cursor-pointer top-0 right-0 m-2 text-xs py-1 px-2 leading-none bg-gray-800 rounded-md
                    ${status.lastStatus === null
                      ? "text-gray-500"
                      : status.lastStatus
                      ? "text-green-500"
                      : "text-red-500"
                    }
                  `}>
                    <span className="relative inline-flex items-center group">
                    {averageUptime}% uptime
                      <div className="absolute left-1/2 bottom-full mb-2 hidden max-w-max w-auto whitespace-nowrap px-4 py-2 text-xs font-medium text-white bg-black rounded-md shadow-md -translate-x-1/2 group-hover:block backdrop-blur-lg bg-opacity-70">
                        Ping every {status.pingInterval / 1000}s
                      </div>
                    </span>
                  </div>
                  <h2 className="text-2xl font-semibold text-white flex items-center">
                    {status.name}
                    {status.showIp && <a href={status.address}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`cursor-pointer m-2 text-xs py-1 px-2 leading-none bg-gray-800 rounded-md
                      ${status.lastStatus === null
                        ? "text-gray-500"
                        : status.lastStatus
                        ? "text-green-500"
                        : "text-red-500"
                      }
                    `}>
                      {status.address}
                    </a>}
                  </h2>
                  <div className="mt-4 flex space-x-1">
                    {daysToDisplay.map((day, idx) => (
                      <div
                        key={idx}
                        className="group relative w-1 h-8"
                      >
                        <div className="absolute left-1/2 bottom-full mb-2 hidden max-w-max w-auto whitespace-nowrap px-4 py-2 text-xs font-medium text-white bg-black rounded-md shadow-md -translate-x-1/2 group-hover:block backdrop-blur-lg bg-opacity-70">
                          <p>{day.date}</p>
                          {day.uptime !== null ? (
                            <>
                              <p>Uptime: {day.uptime.toFixed(2)}%</p>
                              <p>Downtime: {day.downtimeHours?.toFixed(1) || 0} hrs</p>
                            </>
                          ) : (
                            <p>No data available</p>
                          )}
                        </div>

                        <div
                          className={`w-full h-full cursor-pointer rounded-md shadow-lg transition-transform duration-300 ease-in-out transform hover:scale-150 ${
                            day.uptime === null
                              ? "bg-gray-400 bg-opacity-50"
                              : day.uptime >= 75
                              ? "bg-green-400"
                              : day.uptime >= 50
                              ? "bg-yellow-400"
                              : day.uptime >= 25
                              ? "bg-orange-400"
                              : "bg-red-400"
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16">
          <h2 className="text-2xl font-semibold text-white mb-4">Past Incidents</h2>
          {incidents.length > 0 ? (
            incidents.map((incident, index) => (
              <div key={index} className="mb-8">
                <a
                  href={incident.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-bold hover:no-underline text-red-400 hover:underline"
                >
                  {incident.title}
                </a>
                <p className="text-sm text-gray-400">
                {
                  new Date(incident.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }).replace(",", "").replace(":", "h")
                }
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No incidents reported this month.</p>
          )}
        </div>

      </div>
    </div>
  );
}