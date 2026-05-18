// ============================================
// Weather Service — Fetch Live Weather Data
// ============================================

let cachedWeather = {
  temperature: 26.5,
  humidity: 60.0,
  pressure: 1012.0,
  wind_speed: 10.0,
  city: "Karachi (Default)"
};

/**
 * Fetches the current location using IP-based geolocation
 * and gets the real-time weather data from Open-Meteo (keyless free API).
 */
async function fetchLiveWeather() {
  try {
    // 1. Geolocate using IP-API
    const geoResponse = await fetch('http://ip-api.com/json/');
    if (!geoResponse.ok) throw new Error('IP geolocation failed');
    
    const geoData = await geoResponse.json();
    const lat = geoData.lat || 24.8607;
    const lon = geoData.lon || 67.0011;
    const city = geoData.city || 'Karachi';

    // 2. Fetch current weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m`;
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) throw new Error('Weather API request failed');

    const weatherData = await weatherResponse.json();
    const current = weatherData.current;

    cachedWeather = {
      temperature: current.temperature_2m || 26.5,
      humidity: current.relative_humidity_2m || 60.0,
      pressure: current.surface_pressure || 1012.0,
      wind_speed: current.wind_speed_10m || 10.0,
      city: city
    };

    console.log(`[WEATHER] Successfully fetched live weather for ${city}: ${cachedWeather.temperature}°C, ${cachedWeather.humidity}% Humidity, ${cachedWeather.pressure} hPa`);
  } catch (err) {
    console.warn('[WEATHER] Failed to fetch live weather, using cached/default values:', err.message);
  }
  return cachedWeather;
}

// Start periodic update of weather (every 5 minutes)
function startWeatherUpdates() {
  fetchLiveWeather();
  setInterval(fetchLiveWeather, 300000); // 5 minutes
}

module.exports = {
  fetchLiveWeather,
  startWeatherUpdates,
  getWeather: () => cachedWeather
};
