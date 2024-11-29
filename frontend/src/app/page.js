"use client";

import { useEffect, useState } from "react";
import { marked } from "marked";
import axios from "axios";
import {
  FaRegCircleUp,
  FaRegCircleDown,
  FaRegCircleCheck,
  FaRegCircleXmark,
  FaRegCircleQuestion,
  FaRegFaceFrown,
  FaRegFaceLaughBeam,
  FaRegFaceDizzy,
  FaRegFaceSadTear,
  FaHourglassHalf,
  FaLink,
  FaWifi,
  FaCheck,
  FaEllipsis,
  FaEye,
  FaRegBell,
  FaWrench,
  FaRegClock
} from "react-icons/fa6";

export default function Home() {
  const [statuses, setStatuses] = useState([]);
  const [title, setTitle] = useState("Status Page");
  const [description, setDescription] = useState("Check the status of our services below.");
  const [incidents, setIncidents] = useState([]);
  const [isWinter, setIsWinter] = useState(false);

  const fetchStatusData = async () => {
    try {
      const response = await axios.get("./api/status");
      setTitle(response.data.title);
      setDescription(response.data.description);
      setStatuses(response.data.statuses);
    } catch (error) {
      console.error("Error fetching status data:", error);
    }
  };

  const fetchIncidents = async () => {
    try {
      const response = await axios.get("./api/incidents");
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
    }, 2000); // 2 seconds
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkWinter = () => {
      const month = new Date().getMonth();
      setIsWinter(month === 0); // Dec
    };
    
    checkWinter();
    
    const interval = setInterval(() => {
      checkWinter();
    }, 3600000); // 1 hour

    return () => clearInterval(interval);
  }, []);

  const getBgColorIncident = (keyword) => {
    if (keyword.includes("Investigating")) return "bg-red-500";
    if (keyword.includes("Identified")) return "bg-orange-500";
    if (keyword.includes("Update")) return "bg-yellow-500";
    if (keyword.includes("Monitoring")) return "bg-blue-400";
    if (keyword.includes("Resolved")) return "bg-green-400";
    return "bg-gray-500";
  };

  const getBorderColorIncident = (keyword) => {
    if (keyword.includes("Investigating")) return "border-red-500";
    if (keyword.includes("Identified")) return "border-orange-500";
    if (keyword.includes("Update")) return "border-yellow-500";
    if (keyword.includes("Monitoring")) return "border-blue-500";
    if (keyword.includes("Resolved")) return "border-green-500";
    return "border-gray-500";
  };

  const getIconIncident = (keyword) => {
    if (keyword.includes("Investigating")) return <FaEye />;
    if (keyword.includes("Identified")) return <FaWrench />;
    if (keyword.includes("Update")) return <FaRegBell />;
    if (keyword.includes("Monitoring")) return <FaRegClock />;
    if (keyword.includes("Resolved")) return <FaCheck />;
    return <FaEllipsis />;
  };

  return (
    <div className="min-h-screen  text-white flex flex-col items-center justify-center">
      {isWinter && <SnowEffect />}

      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 mt-6">{title}</h1>
        <p className="text-gray-400 mb-8">{description}</p>
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
                          <FaRegCircleCheck className="text-green-400" />
                        ) : (
                          <FaRegCircleXmark className="text-red-500" />
                        )}
                      </div>
                      <h2 className="text-center">
                      {status.address ? (
                        <a
                          href={status.address}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-white no-underline hover:no-underline"
                        >
                          {status.name}
                        </a>
                      ) : (
                        <span>{status.name}</span>
                      )}
                      </h2>
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
                          : "text-red-500"
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
                          {status.address && (
                            <p className="flex items-center space-x-2 text-gray-400">
                              <FaLink />
                              <span>{status.address}</span>
                            </p>
                          )}
                          {status.responseTime && (
                            <p className="flex items-center space-x-2 text-gray-400">
                              <FaWifi />
                              <span>{status.responseTime}ms</span>
                            </p>
                          )}
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
                                    <FaRegFaceLaughBeam className="text-lg" />
                                    <span>Operational</span>
                                  </p>
                                ) : day.uptime >= 50 ? (
                                  <p className="flex items-center space-x-2 text-yellow-400">
                                    <FaRegFaceFrown className="text-lg" />
                                    <span>Degraded</span>
                                  </p>
                                ) : day.uptime >= 25 ? (
                                  <p className="flex items-center space-x-2 text-orange-400">
                                    <FaRegFaceSadTear className="text-lg" />
                                    <span>Partial Outage</span>
                                  </p>
                                ) : (
                                  <p className="flex items-center space-x-2 text-red-500">
                                    <FaRegFaceDizzy className="text-lg" />
                                    <span>Major Outage</span>
                                  </p>
                                )}
                              </div>
                              <p className={`flex items-center space-x-2 ${day.uptime.toFixed(2) === null
                                ? "text-gray-400"
                                : day.uptime.toFixed(2) >= 75
                                ? "text-green-400"
                                : day.uptime.toFixed(2) >= 50
                                ? "text-yellow-400"
                                : day.uptime.toFixed(2) >= 25
                                ? "text-orange-400"
                                : "text-red-500"
                              }`}>
                                <FaRegCircleUp />
                                <span>Uptime: {day.uptime.toFixed(2)}%</span>
                              </p>
                              <p className={`flex items-center space-x-2 ${day.downtimeHours?.toFixed(1) === null
                                ? "text-gray-400"
                                : day.downtimeHours?.toFixed(1) == 0
                                ? "text-green-400"
                                : day.downtimeHours?.toFixed(1) <= 0.1
                                ? "text-yellow-400"
                                : day.downtimeHours?.toFixed(1) <= 0.3
                                ? "text-orange-400"
                                : "text-red-500"
                              }`}>
                                <FaRegCircleDown />
                                <span>Downtime: {day.downtimeHours?.toFixed(1) || 0}h</span>
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
                              : "bg-red-500"
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
        <div className="container">
          {incidents.length > 0 ? (
            incidents.map((incident, index) => (
              <div key={index} className="mb-8">
                <h2 className="text-2xl font-semibold mb-4 text-red-500">
                  <a
                    href={incident.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-underline"
                  >
                  {incident.title}
                  </a>
                <p className="text-sm font-normal text-gray-500">
                  {new Date(incident.createdAt).getDate()} {new Date(incident.createdAt).toLocaleString('default', { month: 'short' })} {new Date(incident.createdAt).getFullYear()} {new Date(incident.createdAt).toLocaleString("en-GB", {hour: "2-digit", minute: "2-digit", hour12: false,}).replace(",", "").replace(":", "h")}
                </p>
                </h2>
                <div className="flex flex-col md:grid grid-cols-12 text-gray-50">
                  {incident.comments.length > 0 ? (
                    incident.comments.map((comment, commentIndex) => {
                      const bgClass = getBgColorIncident(comment.body);
                      const borderClass = getBorderColorIncident(comment.body);
                      return (
                        <div key={commentIndex} className="flex md:contents">
                          <div className="col-start-1 col-end-2 mr-10 md:mx-auto relative">
                            <div className="h-full w-6 flex items-center justify-center">
                              <div className={`h-full w-1 ${bgClass} pointer-events-none`}></div>
                            </div>
                            <div className={`w-6 h-6 absolute text-[#171824]/80 top-1/2 -mt-3 rounded-full ${bgClass} shadow-xl text-center inline-flex items-center justify-center`}>
                              {getIconIncident(comment.body)}
                            </div>
                          </div>
                          <div className={`rounded-xl backdrop-blur-2xl border border-solid ${borderClass} col-start-2 col-end-12 p-4 rounded-xl my-4 mr-auto shadow-md w-full`}>
                            <h3 className="text-sm mb-1">
                              <div dangerouslySetInnerHTML={{ __html: marked(comment.body) }} />
                            </h3>
                            <p className="text-sm mb-1 text-gray-400">
                              @{comment.author} - {" "}
                              <span className="text-gray-500">
                                {new Date(comment.createdAt).toLocaleString()}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-gray-500 text-sm col-start-2 col-end-10">
                      The incident has been reported, and our team will begin investigation shortly. We will keep you updated.
                    </p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-gray-500">No incidents reported this month.</p>
          )}
        </div>

      </div>
    </div>
  );
}
