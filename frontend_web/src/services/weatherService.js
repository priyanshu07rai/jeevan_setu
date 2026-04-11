const API_KEY = '116661157509803ebda49387ad9a23ac';
const BASE_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Fetches current weather data for the given coordinates.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} Weather data object
 */
export const getCurrentWeather = async (lat, lon) => {
  try {
    const response = await fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`);
    if (!response.ok) {
      throw new Error('Failed to fetch weather data');
    }
    const data = await response.json();
    
    // Check for rain in the last 1h (if available in OpenWeather response)
    const hasRain = data.rain ? true : false;

    return {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main, 
      humidity: data.main.humidity,
      wind: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
      rain: hasRain
    };
  } catch (error) {
    console.error("Error fetching weather:", error);
    return null;
  }
};
