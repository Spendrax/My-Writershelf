'use strict';
// THE REAL WEATHER — the attic's round window shows the weather outside right now: day, night, sunset,
// clouds, rain or snow. Tap the window to see the temperature.
//   • where you are: roughly (your city), from this app's Cloudflare helper — no location permission needed
//   • the weather: from Open-Meteo (free, no account), checked every 30 minutes while the app is open
// Customize → Window: "Real weather", or pick a view to always show instead.

const WEATHER_EVERY = 30 * 6e4;
// Open-Meteo's weather codes: what each one looks like through the window, and its name
const CONDITIONS = [
  { codes: [0, 1], view: 'clear', name: 'Clear' },
  { codes: [2, 3], view: 'clouds', name: 'Clouds' },
  { codes: [45, 48], view: 'clouds', name: 'Fog' },
  { codes: [51, 53, 55, 56, 57], view: 'rain', name: 'Drizzle' },
  { codes: [61, 63, 65, 66, 67], view: 'rain', name: 'Rain' },
  { codes: [80, 81, 82], view: 'rain', name: 'Showers' },
  { codes: [71, 73, 75, 77, 85, 86], view: 'snow', name: 'Snow' },
  { codes: [95, 96, 99], view: 'rain', name: 'Thunderstorm' },
];
const conditionOf = (code) => CONDITIONS.find((c) => c.codes.includes(code)) || CONDITIONS[0];

// Once, for people who had the app before: the window switches to the real weather
if (!set.weatherOn) {
  set.look.sky = 'live';
  set.weatherOn = 1;
  saveSet();
}
set.weather ||= {}; // { lat, lon, placeAt, at, code, day, temp, view }

// What the window shows from the last weather read: rain and snow first, sunset/sunrise light, then day or night
function liveView(w) {
  const c = conditionOf(w.code);
  if (c.view === 'rain' || c.view === 'snow') return c.view;
  if (w.dusk) return 'dusk';
  if (!w.day) return 'night';
  return c.view === 'clouds' ? 'clouds' : 'day';
}

function showWeather() {
  if (set.look.sky === 'live') document.documentElement.dataset.sky = set.weather.view || 'night';
}

async function readWeather() {
  if (set.look.sky !== 'live' || !navigator.onLine) return;
  const w = set.weather;
  try {
    // where you are, at most once a day
    if (!w.lat || Date.now() - w.placeAt > 864e5) {
      const p = await fetch(HELPER + '/where', { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
      if (p.lat == null) throw 0;
      Object.assign(w, { lat: (+p.lat).toFixed(2), lon: (+p.lon).toFixed(2), placeAt: Date.now() });
    }
    const q = `latitude=${w.lat}&longitude=${w.lon}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`;
    const d = await fetch('https://api.open-meteo.com/v1/forecast?' + q, { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
    // the times are all in the place's own time zone, so they compare with each other directly
    const now = Date.parse(d.current.time);
    const nearSun = [d.daily.sunrise[0], d.daily.sunset[0]].some((t) => Math.abs(Date.parse(t) - now) < 45 * 6e4);
    Object.assign(w, { at: Date.now(), code: d.current.weather_code, day: !!d.current.is_day, temp: Math.round(d.current.temperature_2m), dusk: nearSun });
    w.view = liveView(w);
    saveSet();
    showWeather();
  } catch {} // no weather right now: the window keeps showing the last one
}

// Tap the window: what it's like outside
$('.porthole').onclick = () => {
  const w = set.weather;
  if (set.look.sky !== 'live') return toast('Customize → Window → Real weather');
  if (w.temp == null) return toast('Couldn’t get the weather right now');
  toast(`${w.temp}° · ${conditionOf(w.code).name}`);
};

on('look', () => {
  showWeather();
  if (set.look.sky === 'live' && Date.now() - (set.weather.at || 0) > WEATHER_EVERY) readWeather();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - (set.weather.at || 0) > WEATHER_EVERY) readWeather();
});
setInterval(readWeather, WEATHER_EVERY);
showWeather();
readWeather();
