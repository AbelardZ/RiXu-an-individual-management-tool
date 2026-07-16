/* ═══════════════════════════════════════════════════════════════════════
   weatherView.js — 天气视图组件
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * 今日顶部面板：天气 + 干支并排
 */
function todayTopPanel() {
  const cities = state.weatherCities;
  const data = state.weatherData;
  const loading = state.weatherLoading;
  const bazi = state.nowStemsBranches;

  return `
    <div class="today-top-panel">
      <div class="today-top-header">
        <h3 class="today-top-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/>
          </svg>
          天气
        </h3>
        ${loading ? `<span class="weather-loading-spinner"></span>` : ""}
        <button class="btn-link weather-manage-btn" data-action="manageWeatherCities">管理城市</button>
      </div>
      <div class="today-top-body">
        <div class="today-top-weather">
          ${data.length ? weatherCards(data, cities) : weatherEmpty()}
          ${state.weatherError ? `<p class="weather-error">${escapeHtml(state.weatherError)}</p>` : ""}
        </div>
        ${bazi ? baziPanel(bazi) : ""}
      </div>
    </div>
  `;
}

/**
 * 天气卡片区域
 */
function weatherSection() {
  const cities = state.weatherCities;
  const data = state.weatherData;
  const loading = state.weatherLoading;

  return `
    <div class="weather-section">
      <div class="weather-header">
        <h3 class="weather-title">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2"/>
          </svg>
          天气
        </h3>
        <div class="weather-actions">
          <button class="btn small" data-action="manageWeatherCities">管理城市</button>
          ${loading ? `<span class="weather-loading-spinner"></span>` : ""}
        </div>
      </div>
      ${data.length ? weatherCards(data, cities) : weatherEmpty()}
      ${state.weatherError ? `<p class="weather-error">${escapeHtml(state.weatherError)}</p>` : ""}
    </div>
  `;
}

function weatherEmpty() {
  return `
    <div class="weather-empty">
      <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="var(--subtle)" stroke-width="1.5" stroke-linecap="round">
        <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 6.34l-1.41 1.41M19.07 19.07l-1.41-1.41"/>
      </svg>
      <p>点击「管理城市」添加城市查看天气</p>
    </div>
  `;
}

function weatherCards(data, cities) {
  return `
    <div class="weather-cards">
      ${data.map((item, i) => weatherCard(item, cities[i])).join("")}
    </div>
  `;
}

function weatherCard(item, city) {
  if (item.error) {
    return `
      <div class="weather-card weather-card-error">
        <div class="weather-card-top">
          <span class="weather-city-name">${escapeHtml(city)}</span>
          <button class="icon-btn weather-remove" data-action="removeWeatherCity" data-city="${escapeHtml(city)}" title="移除">×</button>
        </div>
        <p class="weather-error-msg">${escapeHtml(item.error)}</p>
      </div>
    `;
  }

  const { current, today, areaName } = item;
  const gradient = weatherGradient(current.code);

  return `
    <div class="weather-card" style="--weather-gradient:${gradient}">
      <div class="weather-card-top">
        <div class="weather-city-info">
          <span class="weather-city-name">${escapeHtml(areaName)}</span>
          ${item.country ? `<span class="weather-country">${escapeHtml(item.country)}</span>` : ""}
        </div>
        <button class="icon-btn weather-remove" data-action="removeWeatherCity" data-city="${escapeHtml(city)}" title="移除">×</button>
      </div>
      <div class="weather-card-body">
        <div class="weather-main">
          <div class="weather-icon">${weatherIcon(current.code)}</div>
          <div class="weather-temp">
            <span class="weather-temp-value">${current.temp}</span>
            <span class="weather-temp-unit">°C</span>
          </div>
        </div>
        <div class="weather-desc">${escapeHtml(current.desc)}</div>
        <div class="weather-details">
          <div class="weather-detail-item">
            <span class="weather-detail-label">体感</span>
            <span class="weather-detail-value">${current.feelsLike}°</span>
          </div>
          <div class="weather-detail-item">
            <span class="weather-detail-label">湿度</span>
            <span class="weather-detail-value">${current.humidity}%</span>
          </div>
          <div class="weather-detail-item">
            <span class="weather-detail-label">风力</span>
            <span class="weather-detail-value">${current.windDir} ${current.windSpeed}km/h</span>
          </div>
        </div>
        <div class="weather-hilo">
          <span class="weather-high">↑ ${today.high}°</span>
          <span class="weather-low">↓ ${today.low}°</span>
          <span class="weather-sun">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/></svg>
            ${today.sunrise}
          </span>
          <span class="weather-sun">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15a6 6 0 1 0-12 0"/><path d="M12 9v6"/></svg>
            ${today.sunset}
          </span>
        </div>
      </div>
      ${item.forecast?.length ? weatherForecast(item.forecast) : ""}
    </div>
  `;
}

function weatherForecast(forecast) {
  return `
    <div class="weather-forecast">
      ${forecast.map((day) => {
        const date = new Date(day.date + "T00:00:00");
        const label = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
        const isToday = day.date === todayISO();
        return `
          <div class="weather-forecast-day ${isToday ? "is-today" : ""}">
            <span class="weather-forecast-label">${isToday ? "今天" : label}</span>
            <span class="weather-forecast-icon">${weatherIcon(day.code)}</span>
            <span class="weather-forecast-temp">${day.high}° <small>${day.low}°</small></span>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

/**
 * 管理城市对话框（添加 + 删除）
 */
function weatherCityDialog() {
  const cities = state.weatherCities;
  return `
    <div class="modal-backdrop" data-action="closeWeatherDialog">
      <section class="weather-city-modal" role="dialog" aria-modal="true" aria-label="管理天气城市" data-modal-panel="weatherCity">
        <div class="modal-head">
          <div>
            <h3>管理天气城市</h3>
            <p>最多可添加 3 个城市，支持中文或英文名称</p>
          </div>
          <button class="icon-btn" type="button" data-action="closeWeatherDialog">×</button>
        </div>
        <div class="weather-city-body">
          ${cities.length ? `
            <div class="weather-city-list">
              <span class="weather-suggestion-label">已添加的城市</span>
              <div class="weather-city-chips">
                ${cities.map((city) => `
                  <span class="weather-city-chip">
                    <span class="weather-city-chip-name">${escapeHtml(city)}</span>
                    <button type="button" class="weather-city-chip-remove" data-action="removeWeatherCity" data-city="${escapeHtml(city)}" title="移除 ${escapeHtml(city)}">×</button>
                  </span>
                `).join("")}
              </div>
            </div>
          ` : ""}
          ${cities.length < 3 ? `
            <div class="weather-city-add-section">
              <span class="weather-suggestion-label">添加城市</span>
              <form class="weather-city-form" data-submit="weatherCity">
                <div class="weather-city-input-row">
                  <input type="text" name="city" placeholder="输入城市名称，例如：北京、Shanghai、Tokyo" required autofocus />
                  <button type="submit" class="btn primary">添加</button>
                </div>
              </form>
              <div class="weather-city-suggestions">
                <span class="weather-suggestion-label">快速选择</span>
                <div class="weather-suggestion-chips">
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="北京">北京</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="上海">上海</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="广州">广州</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="深圳">深圳</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="杭州">杭州</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="成都">成都</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="重庆">重庆</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="武汉">武汉</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="南京">南京</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="Tokyo">东京</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="New York">纽约</button>
                  <button type="button" class="btn small" data-action="quickAddCity" data-city="London">伦敦</button>
                </div>
              </div>
            </div>
          ` : `<p class="weather-city-full-hint">已达到 3 个城市上限，请先移除再添加</p>`}
        </div>
      </section>
    </div>
  `;
}

/* ═══════════════════════════════════════════════════════════════════════
   八字展示组件
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * 天干五行颜色映射
 */
const STEM_ELEMENT = {
  "甲": "木", "乙": "木",
  "丙": "火", "丁": "火",
  "戊": "土", "己": "土",
  "庚": "金", "辛": "金",
  "壬": "水", "癸": "水",
};

/**
 * 地支五行颜色映射
 */
const BRANCH_ELEMENT = {
  "子": "水", "丑": "土",
  "寅": "木", "卯": "木",
  "辰": "土", "巳": "火",
  "午": "火", "未": "土",
  "申": "金", "酉": "金",
  "戌": "土", "亥": "水",
};

/**
 * 五行颜色（深色稳重版）
 */
const ELEMENT_COLORS = {
  "木": "#2d6a4f",
  "火": "#c1121f",
  "土": "#b5830a",
  "金": "#b8860b",
  "水": "#1d4ed8",
};

function elementColor(char) {
  const element = STEM_ELEMENT[char] || BRANCH_ELEMENT[char] || "";
  return ELEMENT_COLORS[element] || "var(--ink)";
}

/**
 * 干支面板（撑满高度，与天气卡片等高）+ 择日信息
 */
function baziPanel(bazi) {
  const pillars = bazi.pillars || {};
  const almanac = bazi.almanac || {};
  const labels = { year: "年", month: "月", day: "日", hour: "时" };

  return `
    <div class="bazi-panel">
      <div class="bazi-panel-head">
        <div>
          <strong>四柱干支</strong>
          <span>${bazi.lunar_text ? escapeHtml(bazi.lunar_text) : "此刻"}</span>
        </div>
      </div>
      <div class="bazi-panel-chars">
        ${["year", "month", "day", "hour"].map((key) => {
          const pillar = pillars[key];
          const stem = pillar?.stem || "--";
          const branch = pillar?.branch || "--";
          return `<span class="bazi-panel-pair">
            <em>${labels[key]}</em>
            <span class="bazi-panel-glyphs">
              <span class="bazi-panel-char" style="color:${elementColor(stem)}">${escapeHtml(stem)}</span>
              <span class="bazi-panel-char" style="color:${elementColor(branch)}">${escapeHtml(branch)}</span>
            </span>
          </span>`;
        }).join("")}
      </div>
      ${almanac.yi?.length || almanac.ji?.length ? `
        <div class="bazi-almanac">
          <div class="bazi-almanac-title">择日参考</div>
          ${almanac.yi?.length ? `<div class="bazi-almanac-row bazi-almanac-yi"><span class="bazi-almanac-label">宜</span><span class="bazi-almanac-items">${almanac.yi.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</span></div>` : ""}
          ${almanac.ji?.length ? `<div class="bazi-almanac-row bazi-almanac-ji"><span class="bazi-almanac-label">忌</span><span class="bazi-almanac-items">${almanac.ji.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</span></div>` : ""}
          ${almanac.ji_shen?.length ? `<div class="bazi-almanac-row bazi-almanac-shen"><span class="bazi-almanac-label">吉神</span><span class="bazi-almanac-items">${almanac.ji_shen.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</span></div>` : ""}
          ${almanac.xiong_sha?.length ? `<div class="bazi-almanac-row bazi-almanac-sha"><span class="bazi-almanac-label">凶煞</span><span class="bazi-almanac-items">${almanac.xiong_sha.map((s) => `<span>${escapeHtml(s)}</span>`).join("")}</span></div>` : ""}
        </div>
      ` : ""}
    </div>
  `;
}
