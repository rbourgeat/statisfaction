"use client";

import { useEffect, useState } from "react";
import axios from "axios";

import {
  FaRegCircleCheck,
  FaFaceFrown,
  FaFaceLaughBeam,
  FaFaceDizzy,
  FaFaceSadCry,
  FaHourglassHalf,
  FaCircleUp,
  FaCircleDown,
  FaRegCircleXmark,
  FaRegCircleQuestion,
  FaRegCalendarXmark
} from "react-icons/fa6";

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
    <div className="min-h-screen bg-[#0b0c14] text-white flex flex-col items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4 mt-6">{title}</h1>
          <p className="text-gray-400 mb-8">Check the status of our services below.</p>
        </div>
        <div className="max-w-4xl p-4 mb-2 p-2 rounded-xl backdrop-blur-2xl border border-[#727DA1]/20 bg-[#171824]/80">
          <div className="grid grid-cols-1 gap-2">
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
                <div key={index} className="relative">
                  <div className="p-6">
                    <div className="flex justify-between items-center">
                      <h2 className="font-semibold text-white flex items-center">
                        <div className={`text-md mr-2 bg-[#171824]/80`}>
                          {status.lastStatus === null ? (
                            <FaRegCircleQuestion className="text-gray-500" />
                          ) : status.lastStatus ? (
                            <FaRegCircleCheck className="text-green-500" />
                          ) : (
                            <FaRegCircleXmark className="text-red-500" />
                          )}
                        </div>
                        {status.name}
                      </h2>

                      <div
                        className={`font-semibold cursor-pointer text-xs
                          ${averageUptime === null
                            ? "text-gray-400"
                            : averageUptime >= 75
                            ? "text-green-400"
                            : averageUptime >= 50
                            ? "text-yellow-400"
                            : averageUptime >= 25
                            ? "text-orange-400"
                            : "text-red-400"
                          }`}
                      >
                        <span className="relative items-center group flex justify-center">
                          <h2 className="text-center">
                            {averageUptime}% uptime
                          </h2>
                          <div className="absolute left-1/2 mb-2 hidden max-w-max w-auto whitespace-nowrap px-4 py-2 text-xs font-medium text-white translate-x-1/2 group-hover:block rounded-xl backdrop-blur-2xl border border-[#727DA1]/20 bg-[#171824]/80">
                            <p className="flex items-center space-x-2 text-gray-400">
                              <FaHourglassHalf />
                              <span>Ping every {status.pingInterval / 1000}s</span>
                            </p>
                          </div>
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex space-x-1">
                      {daysToDisplay.map((day, idx) => (
                        <div
                          key={idx}
                          className="group relative w-1 h-8"
                        >
                          <div className="absolute left-1/2 bottom-full mb-4 hidden max-w-max w-auto whitespace-nowrap px-4 py-2 text-xs font-medium text-white -translate-x-1/2 group-hover:block rounded-xl backdrop-blur-2xl border border-[#727DA1]/20 bg-[#171824]/80">
                            {day.uptime !== null ? (
                              <div>
                                <div className="border-b border-gray-700 pb-2 mb-2 text-center font-bold">
                                  {day.uptime >= 75 ? (
                                    <p className="flex items-center space-x-2 text-green-400">
                                      <FaFaceLaughBeam className="text-lg" />
                                      <span>Operational</span>
                                    </p>
                                  ) : day.uptime >= 50 ? (
                                    <p className="flex items-center space-x-2 text-yellow-400">
                                      <FaFaceFrown className="text-lg" />
                                      <span>Degraded</span>
                                    </p>
                                  ) : day.uptime >= 25 ? (
                                    <p className="flex items-center space-x-2 text-orange-400">
                                      <FaFaceSadCry className="text-lg" />
                                      <span>Partial Outage</span>
                                    </p>
                                  ) : (
                                    <p className="flex items-center space-x-2 text-red-400">
                                      <FaFaceDizzy className="text-lg" />
                                      <span>Major Outage</span>
                                    </p>
                                  )}
                                </div>
                                <p className="flex items-center space-x-2">
                                  <FaCircleUp />
                                  <span>Uptime: {day.uptime.toFixed(2)}%</span>
                                </p>
                                <p className="flex items-center space-x-2">
                                  <FaCircleDown />
                                  <span>Downtime: {day.downtimeHours?.toFixed(1) || 0} h</span>
                                </p>
                              </div>
                            ) : (
                              <p>No data available</p>
                            )}
                            <p className="border-t border-gray-700 pt-2 mt-2 text-center text-gray-400">
                              {new Date(day.date).getDate()} {new Date(day.date).toLocaleString('default', { month: 'short' })} {new Date(day.date).getFullYear()}
                            </p>
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
        </div>

        <h2 className="m-16 text-2xl font-semibold text-white mb-4">Past Incidents</h2>
        <div className="m-4 p-4 w-[60%] rounded-xl backdrop-blur-2xl border border-[#727DA1]/20 bg-[#171824]/80">
          {incidents.length > 0 ? (
            incidents.map((incident, index) => (
              <div key={index} className="m-4 pl-8">
                <a
                  href={incident.issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg font-bold hover:no-underline text-red-400 hover:underline flex items-center space-x-2"
                >
                  <FaRegCalendarXmark />
                  <span>{incident.title}</span>
                </a>
                <p className="text-sm text-gray-400">
                {new Date(incident.createdAt).getDate()} {new Date(incident.createdAt).toLocaleString('default', { month: 'short' })} {new Date(incident.createdAt).getFullYear()} {new Date(incident.createdAt).toLocaleString("en-GB", {hour: "2-digit", minute: "2-digit", hour12: false,}).replace(",", "").replace(":", "h")}
                </p>
              </div>
            ))
          ) : (
            <p className="text-gray-500">No incidents reported this month.</p>
          )}
        </div>
    </div>
  );
}
