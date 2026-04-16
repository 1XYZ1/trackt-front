"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [message, setMessage] = useState("Loading...");

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Error connecting to API"));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-4">
          Trackt
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400">
          API says: <span className="font-semibold text-black dark:text-white">{message}</span>
        </p>
      </div>
    </div>
  );
}
