/* ═══════════════════════════════════════════════════════════════════════
   weatherService.js — 天气服务
   使用 wttr.in 免费 API 获取天气数据
   ═══════════════════════════════════════════════════════════════════════ */

const WEATHER_API = "https://wttr.in";
const WEATHER_REQUEST_TIMEOUT_MS = 8000;
const WEATHER_CITY_ALIASES = {
  "\u5317\u4eac": "Beijing",
  "\u4e0a\u6d77": "Shanghai",
  "\u5e7f\u5dde": "Guangzhou",
  "\u6df1\u5733": "Shenzhen",
  "\u676d\u5dde": "Hangzhou",
  "\u6210\u90fd": "Chengdu",
  "\u91cd\u5e86": "Chongqing",
  "\u6b66\u6c49": "Wuhan",
  "\u5357\u4eac": "Nanjing",
  "\u5929\u6d25": "Tianjin",
  "\u897f\u5b89": "Xi'an",
  "\u82cf\u5dde": "Suzhou",
  "\u9752\u5c9b": "Qingdao",
  "\u53a6\u95e8": "Xiamen",
};

/**
 * 获取单个城市的天气数据
 * @param {string} city - 城市名称（中文或英文）
 * @returns {Promise<object>} 天气数据
 */
async function fetchCityWeather(city) {
  const candidates = weatherQueryCandidates(city);
  let lastError = null;

  for (const query of candidates) {
    try {
      const data = await fetchWeatherJson(query);
      return parseWeatherData(city, data);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(formatWeatherError(city, lastError));
}

function weatherQueryCandidates(city) {
  const trimmed = city.trim();
  const alias = WEATHER_CITY_ALIASES[trimmed];
  return [...new Set([trimmed, alias].filter(Boolean))];
}

async function fetchWeatherJson(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WEATHER_REQUEST_TIMEOUT_MS);
  const url = `${WEATHER_API}/${encodeURIComponent(query)}?format=j1&lang=zh`;

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function formatWeatherError(city, err) {
  let reason = "\u672a\u77e5\u539f\u56e0";
  if (err?.name === "AbortError") reason = "\u8bf7\u6c42\u8d85\u65f6";
  else if (err?.message?.startsWith("HTTP")) reason = err.message;
  else if (err instanceof TypeError) reason = "\u7f51\u7edc\u8fde\u63a5\u6216\u8de8\u57df\u53d7\u9650";
  else if (err?.message) reason = err.message;
  return `\u83b7\u53d6 ${city} \u5929\u6c14\u5931\u8d25\uff1a${reason}`;
}

/**
 * 解析 wttr.in 返回的 JSON 数据
 */
function parseWeatherData(city, data) {
  const current = data.current_condition?.[0];
  const forecast = data.weather || [];
  const nearest = data.nearest_area?.[0];

  // 当前天气
  const tempC = current?.temp_C || "--";
  const feelsLikeC = current?.FeelsLikeC || "--";
  const humidity = current?.humidity || "--";
  const weatherDesc = current?.weatherDesc?.[0]?.value || "--";
  const weatherCode = current?.weatherCode || "113";
  const windSpeed = current?.windspeedKmph || "--";
  const windDir = current?.winddir16Point || "--";
  const visibility = current?.visibility || "--";
  const uvIndex = current?.uvIndex || "--";

  // 区域名称
  const areaName = nearest?.areaName?.[0]?.value || city;
  const country = nearest?.country?.[0]?.value || "";

  // 今日预报
  const todayForecast = forecast[0];
  const highTemp = todayForecast?.maxtempC || "--";
  const lowTemp = todayForecast?.mintempC || "--";
  const sunrise = todayForecast?.astronomy?.[0]?.sunrise || "--";
  const sunset = todayForecast?.astronomy?.[0]?.sunset || "--";

  // 未来几天预报
  const dailyForecast = forecast.slice(0, 3).map((day) => ({
    date: day.date,
    high: day.maxtempC,
    low: day.mintempC,
    code: day.hourly?.[4]?.weatherCode || "113",
    desc: day.hourly?.[4]?.weatherDesc?.[0]?.value || "",
  }));

  return {
    city,
    areaName,
    country,
    current: {
      temp: tempC,
      feelsLike: feelsLikeC,
      humidity,
      desc: weatherDesc,
      code: weatherCode,
      windSpeed,
      windDir,
      visibility,
      uvIndex,
    },
    today: {
      high: highTemp,
      low: lowTemp,
      sunrise,
      sunset,
    },
    forecast: dailyForecast,
  };
}

/**
 * 获取所有已保存城市的天气
 */
async function fetchAllWeather() {
  if (!state.weatherCities.length) {
    state.weatherData = [];
    return;
  }
  state.weatherLoading = true;
  state.weatherError = "";
  render();

  try {
    const results = await Promise.allSettled(
      state.weatherCities.map((city) => fetchCityWeather(city))
    );
    state.weatherData = results.map((result, i) => {
      if (result.status === "fulfilled") return result.value;
      return { city: state.weatherCities[i], error: result.reason?.message || "获取失败" };
    });
  } catch (err) {
    state.weatherError = err.message;
  } finally {
    state.weatherLoading = false;
  }
}

/**
 * 添加城市
 */
function addWeatherCity(city) {
  const trimmed = city.trim();
  if (!trimmed) return;
  if (state.weatherCities.length >= 3) {
    setToast("最多添加 3 个城市");
    return;
  }
  if (state.weatherCities.includes(trimmed)) {
    setToast("该城市已添加");
    return;
  }
  state.weatherCities.push(trimmed);
  saveWeatherCities();
  fetchAllWeather();
}

/**
 * 移除城市
 */
function removeWeatherCity(city) {
  state.weatherCities = state.weatherCities.filter((c) => c !== city);
  saveWeatherCities();
  fetchAllWeather();
}

/**
 * 持久化城市列表（仅后端数据库）
 */
function saveWeatherCities() {
  request("/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify({ weather_cities: state.weatherCities }),
  }).catch(() => {});
}

/**
 * 从后端加载天气城市（登录后调用）
 */
async function loadWeatherCitiesFromProfile() {
  try {
    const profile = await request("/users/me/profile");
    if (profile?.weather_cities?.length) {
      state.weatherCities = profile.weather_cities;
    }
  } catch {
    // 保持空列表
  }
}

/**
 * 天气图标映射（基于 wttr.in weatherCode）
 */
function weatherIcon(code) {
  const s = 32;
  const map = {
    // 晴天
    113: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 6.34l-1.41 1.41M19.07 19.07l-1.41-1.41"/></svg>`,
    // 晴间多云
    116: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M2 12h2"/><path d="M18 9a3 3 0 1 0 0 6 4 4 0 0 0 0-6Z" stroke="#94a3b8"/></svg>`,
    // 多云
    119: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"><path d="M18 10a4 4 0 0 0-3.46-3.96A4.5 4.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 6 15h12a4 4 0 0 0 0-5Z"/></svg>`,
    // 阴天
    122: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#64748b" stroke-width="1.5" stroke-linecap="round"><path d="M18 10a4 4 0 0 0-3.46-3.96A4.5 4.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 6 15h12a4 4 0 0 0 0-5Z"/><path d="M6 15a3 3 0 1 0 0 6h12a3 3 0 1 0 0-6"/></svg>`,
    // 雾
    143: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"><path d="M3 10h18M3 14h18M7 18h10"/></svg>`,
    // 小雨
    176: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"><path d="M18 10a4 4 0 0 0-3.46-3.96A4.5 4.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 6 15h12a4 4 0 0 0 0-5Z"/><path d="M8 18v2M12 18v3M16 18v2"/></svg>`,
    // 雨
    296: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-linecap="round"><path d="M18 10a4 4 0 0 0-3.46-3.96A4.5 4.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 6 15h12a4 4 0 0 0 0-5Z"/><path d="M8 18v3M12 18v4M16 18v3"/></svg>`,
    // 大雪
    230: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"><path d="M18 10a4 4 0 0 0-3.46-3.96A4.5 4.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 6 15h12a4 4 0 0 0 0-5Z"/><path d="M8 18v2M12 18v3M16 18v2M10 20l-2 2M14 20l2 2"/></svg>`,
    // 雷
    200: `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10a4 4 0 0 0-3.46-3.96A4.5 4.5 0 0 0 6.5 8.5 3.5 3.5 0 0 0 6 15h12a4 4 0 0 0 0-5Z"/><path d="M13 15l-2 4h4l-2 3"/></svg>`,
  };
  // 默认返回多云图标
  return map[code] || map[119];
}

/**
 * 天气背景渐变映射
 */
function weatherGradient(code) {
  const c = String(code);
  if (c === "113") return "linear-gradient(135deg, #fef3c7, #fde68a)";
  if (c === "116") return "linear-gradient(135deg, #fef3c7, #e2e8f0)";
  if (["119", "122"].includes(c)) return "linear-gradient(135deg, #e2e8f0, #cbd5e1)";
  if (["143", "248", "260"].includes(c)) return "linear-gradient(135deg, #cbd5e1, #94a3b8)";
  if (["176", "263", "266", "293", "296", "299", "302", "305", "308", "311", "314"].includes(c)) return "linear-gradient(135deg, #bfdbfe, #93c5fd)";
  if (["179", "182", "185", "227", "230", "323", "326", "329", "332", "335", "338", "350", "368", "371", "392", "395"].includes(c)) return "linear-gradient(135deg, #e0e7ff, #c7d2fe)";
  if (["200", "386", "389"].includes(c)) return "linear-gradient(135deg, #d1d5db, #9ca3af)";
  return "linear-gradient(135deg, #e2e8f0, #cbd5e1)";
}
