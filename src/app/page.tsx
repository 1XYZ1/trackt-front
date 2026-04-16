"use client";

import { useEffect, useState } from "react";

interface Message {
  id: number;
  text: string;
  created_at: string;
}

export default function Home() {
  const [apiMessage, setApiMessage] = useState("Loading...");
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

    fetch(apiUrl)
      .then((res) => res.json())
      .then((data) => setApiMessage(data.message))
      .catch(() => setApiMessage("Error connecting to API"));

    fetch(`${apiUrl}/messages`)
      .then((res) => res.json())
      .then((data) => setMessages(data))
      .catch(() => setMessages([]));
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-black dark:text-white mb-4">
          Trackt
        </h1>
        <p className="text-xl text-zinc-600 dark:text-zinc-400 mb-6">
          API says: <span className="font-semibold text-black dark:text-white">{apiMessage}</span>
        </p>
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-black dark:text-white mb-2">
            Messages from Supabase
          </h2>
          {messages.length === 0 ? (
            <p className="text-zinc-500">No messages</p>
          ) : (
            <ul className="space-y-2">
              {messages.map((msg) => (
                <li key={msg.id} className="text-zinc-600 dark:text-zinc-400">
                  {msg.text}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
