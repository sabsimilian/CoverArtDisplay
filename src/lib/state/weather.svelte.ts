// Current weather for the info layout, from Open-Meteo (free, no key — see
// get_weather in lib.rs). Not a Spotify call, so it doesn't touch the quota.

import { appApi } from "../tauri/api";
import type { WeatherNow } from "../tauri/types";

const REFRESH_MS = 20 * 60 * 1000;
const RETRY_MS = 2 * 60 * 1000;

let current = $state<WeatherNow | null>(null);
let currentLocation = "";
let timer: ReturnType<typeof setTimeout> | null = null;
let users = 0;

// WMO weather interpretation codes, as Open-Meteo reports them.
const DESCRIPTIONS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Freezing fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  56: "Freezing drizzle",
  57: "Freezing drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm, hail",
  99: "Thunderstorm, hail",
};

export const weather = {
  // "14° · Light rain", or "" when there's nothing to show.
  get label(): string {
    if (!current) return "";
    const text = DESCRIPTIONS[current.weatherCode];
    const temp = `${Math.round(current.temperature)}°`;
    return text ? `${temp} · ${text}` : temp;
  },
};

async function refresh(): Promise<void> {
  timer = null;
  const location = currentLocation;
  let delay = REFRESH_MS;
  try {
    const result = await appApi.getWeather(location);
    if (location === currentLocation) current = result;
  } catch (e) {
    // Hide the line rather than show stale or partial weather.
    console.warn(`Weather for "${location}" failed: ${e}`);
    if (location === currentLocation) current = null;
    delay = RETRY_MS;
  }
  if (users > 0 && location === currentLocation && !timer) timer = setTimeout(refresh, delay);
}

// Called from a component $effect while the weather is on screen; the
// returned function stops it. Several views can hold it at once.
export function watchWeather(location: string): () => void {
  location = location.trim();
  users++;
  if (location !== currentLocation) {
    currentLocation = location;
    current = null;
    if (timer) clearTimeout(timer);
    timer = null;
  }
  if (location && !timer) void refresh();
  return () => {
    users--;
    if (users === 0 && timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
}
