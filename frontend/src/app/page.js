"use client";

import { useEffect, useState } from "react";
import axios from "axios";

export default function Home() {
  const [statuses, setStatuses] = useState([]);
  const [title, setTitle] = useState("Status Page");

  const fetchStatusData = async () => {
    try {
      const response = await axios.get("http://localhost:3001/api/status");
      setTitle(response.data.title);
      setStatuses(response.data.statuses);
    } catch (error) {
      console.error("Error fetching status data:", error);
    }
  };

  useEffect(() => {
    fetchStatusData();
    const interval = setInterval(fetchStatusData, 1000);

    return () => clearInterval(interval);
  }, []);

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