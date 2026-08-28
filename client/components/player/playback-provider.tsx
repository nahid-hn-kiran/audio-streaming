"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Track } from "@/lib/catalog";
import { getPlayback } from "@/lib/catalog";
import { createHistory } from "@/lib/likes-history";

type Playback = { currentTrack: Track | null; isPlaying: boolean; isLoading: boolean; currentTime: number; duration: number; volume: number; error: string; play: (track: Track) => void; pause: () => void; resume: () => void; togglePlay: () => void; seek: (n: number) => void; setVolume: (n: number) => void; stop: () => void };
const Context = createContext<Playback | null>(null);

export function PlaybackProvider({ children }: { children: React.ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const volumeRef = useRef(1);
  const recorded = useRef<string | null>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [url, setUrl] = useState("");
  const [isPlaying, setPlaying] = useState(false);
  const [isLoading, setLoading] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVol] = useState(1);
  const [error, setError] = useState("");

  const play = useCallback((next: Track) => {
    setTrack(next); setUrl(""); setPlaying(false); setCurrent(0); setDuration(0); setError(""); setLoading(true);
    void getPlayback(next.id).then((result) => setUrl(result.data.url)).catch(() => setError("Playback is unavailable for this track.")).finally(() => setLoading(false));
  }, []);

  // Volume is deliberately independent from source loading. It must never reload or restart audio.
  useEffect(() => { volumeRef.current = volume; if (audio.current) audio.current.volume = volume; }, [volume]);

  useEffect(() => {
    if (!url || !audio.current) return;
    audio.current.src = url;
    audio.current.volume = volumeRef.current;
    void audio.current.play().then(() => {
      setPlaying(true);
      if (track && recorded.current !== track.id) { recorded.current = track.id; void createHistory(track.id, { completed: false, source: "TRACK_PAGE" }).catch(() => undefined); }
    }).catch(() => setError("Playback could not start."));
  }, [url, track]);

  const pause = () => { audio.current?.pause(); setPlaying(false); };
  const resume = () => { void audio.current?.play().then(() => setPlaying(true)).catch(() => setError("Playback could not start.")); };
  const value = useMemo(() => ({ currentTrack: track, isPlaying, isLoading, currentTime, duration, volume, error, play, pause, resume, togglePlay: () => isPlaying ? pause() : resume(), seek: (n: number) => { if (audio.current) audio.current.currentTime = n; setCurrent(n); }, setVolume: (n: number) => { setVol(n); if (audio.current) audio.current.volume = n; }, stop: () => { if (audio.current) { audio.current.pause(); audio.current.currentTime = 0; } setPlaying(false); setTrack(null); setUrl(""); } }), [track, isPlaying, isLoading, currentTime, duration, volume, error, play]);
  return <Context.Provider value={value}>{children}<audio ref={audio} onTimeUpdate={(event) => setCurrent(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => setPlaying(false)} /></Context.Provider>;
}

export function usePlayback() { const value = useContext(Context); if (!value) throw new Error("usePlayback must be used within PlaybackProvider"); return value; }
