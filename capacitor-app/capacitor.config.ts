import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dayorder.app',
  appName: '日序',
  webDir: 'www',
  server: {
    // 开发时允许从本地文件加载（生产环境会使用 WebView 加载）
    androidScheme: 'https',
    iosScheme: 'capacitor',
    // 允许访问远程 API（CORS 已在后端配置）
    allowNavigation: ['39.104.75.202', '127.0.0.1'],
  },
  android: {
    allowMixedContent: true,  // 允许 HTTP 请求（开发阶段）
  },
  plugins: {
    // 本地通知（番茄钟提醒）
    LocalNotifications: {
      smallIcon: 'ic_stat_dayorder',
      iconColor: '#5B5F97',
    },
    // Capacitor SQLite
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase',
      androidDatabaseLocation: 'default',
    },
  },
};

export default config;
