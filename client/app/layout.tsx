import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { PlaybackProvider } from "@/components/player/playback-provider";
import { AudioPlayer } from "@/components/audio-player";

export const metadata: Metadata = {
  title: "Audio Streaming",
  description: "An audio streaming platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><AuthProvider><PlaybackProvider>{children}<AudioPlayer /></PlaybackProvider></AuthProvider></body>
    </html>
  );
}
