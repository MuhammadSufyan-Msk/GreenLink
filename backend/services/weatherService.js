// ============================================
// Weather Service — Fetch Live Weather Data
// ============================================

let cachedWeather = {
  temperature: 28.5,
  humidity: 55.0,
  pressure: 1008.0,
  wind_speed: 12.0,
  city: "Faisalabad"
};

/**
 * Gets the real-time weather data from Open-Meteo for Faisalabad.
 */
async function fetchLiveWeather() {
  try {
    // Hardcode Faisalabad coordinates to guarantee Faisalabad live data
    const lat = 31.4504;
    const lon = 73.1350;
    const city = 'Faisalabad';

    // Fetch current weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m`;
    const weatherResponse = await fetch(weatherUrl);
    if (!weatherResponse.ok) throw new Error('Weather API request failed');

    const weatherData = await weatherResponse.json();
    const current = weatherData.current;

    cachedWeather = {
      temperature: current.temperature_2m || 28.5,
      humidity: current.relative_humidity_2m || 55.0,
      pressure: current.surface_pressure || 1008.0,
      wind_speed: current.wind_speed_10m || 12.0,
      city: city
    };

    console.log(`[WEATHER] Successfully fetched live weather for ${city}: ${cachedWeather.temperature}°C, ${cachedWeather.humidity}% Humidity, ${cachedWeather.pressure} hPa`);
  } catch (err) {
    console.warn('[WEATHER] Failed to fetch live weather for Faisalabad, using cached/default values:', err.message);
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
