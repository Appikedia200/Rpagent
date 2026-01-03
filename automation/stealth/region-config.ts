/**
 * @fileoverview Region Configuration for Anti-Detection
 * @module automation/stealth/region-config
 *
 * Provides real user agents, timezones, languages, and geolocation
 * for different regions. These are REAL values from actual browsers.
 *
 * User agents are from the latest Chrome stable versions.
 * Timezones and locales match the region exactly.
 */

import { logger } from '../../electron/utils/logger';

/**
 * Region configuration
 */
export interface RegionConfig {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  
  // Real Chrome user agents (updated December 2024)
  userAgents: string[];
  
  // Timezone
  timezone: string;
  timezoneOffset: number; // minutes from UTC
  
  // Language/Locale
  language: string;
  languages: string[];
  locale: string;
  
  // Geolocation (approximate center of region)
  geolocation: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  
  // Accept-Language header
  acceptLanguage: string;
}

/**
 * Real Chrome user agents from actual browsers (December 2024)
 * These are NOT blacklisted and pass detection
 */
const CHROME_USER_AGENTS = {
  windows: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ],
  mac: [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  ],
  linux: [
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  ],
};

/**
 * Get platform-specific user agents
 */
function getPlatformUserAgents(): string[] {
  const platform = process.platform;
  if (platform === 'win32') return CHROME_USER_AGENTS.windows;
  if (platform === 'darwin') return CHROME_USER_AGENTS.mac;
  return CHROME_USER_AGENTS.linux;
}

/**
 * Region configurations with real data
 */
export const REGIONS: RegionConfig[] = [
  {
    id: 'us-east',
    name: 'United States (East)',
    country: 'United States',
    countryCode: 'US',
    userAgents: getPlatformUserAgents(),
    timezone: 'America/New_York',
    timezoneOffset: -300,
    language: 'en-US',
    languages: ['en-US', 'en'],
    locale: 'en-US',
    geolocation: { latitude: 40.7128, longitude: -74.0060, accuracy: 100 }, // NYC
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    id: 'us-west',
    name: 'United States (West)',
    country: 'United States',
    countryCode: 'US',
    userAgents: getPlatformUserAgents(),
    timezone: 'America/Los_Angeles',
    timezoneOffset: -480,
    language: 'en-US',
    languages: ['en-US', 'en'],
    locale: 'en-US',
    geolocation: { latitude: 34.0522, longitude: -118.2437, accuracy: 100 }, // LA
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    id: 'us-central',
    name: 'United States (Central)',
    country: 'United States',
    countryCode: 'US',
    userAgents: getPlatformUserAgents(),
    timezone: 'America/Chicago',
    timezoneOffset: -360,
    language: 'en-US',
    languages: ['en-US', 'en'],
    locale: 'en-US',
    geolocation: { latitude: 41.8781, longitude: -87.6298, accuracy: 100 }, // Chicago
    acceptLanguage: 'en-US,en;q=0.9',
  },
  {
    id: 'uk',
    name: 'United Kingdom',
    country: 'United Kingdom',
    countryCode: 'GB',
    userAgents: getPlatformUserAgents(),
    timezone: 'Europe/London',
    timezoneOffset: 0,
    language: 'en-GB',
    languages: ['en-GB', 'en'],
    locale: 'en-GB',
    geolocation: { latitude: 51.5074, longitude: -0.1278, accuracy: 100 }, // London
    acceptLanguage: 'en-GB,en;q=0.9',
  },
  {
    id: 'germany',
    name: 'Germany',
    country: 'Germany',
    countryCode: 'DE',
    userAgents: getPlatformUserAgents(),
    timezone: 'Europe/Berlin',
    timezoneOffset: 60,
    language: 'de-DE',
    languages: ['de-DE', 'de', 'en'],
    locale: 'de-DE',
    geolocation: { latitude: 52.5200, longitude: 13.4050, accuracy: 100 }, // Berlin
    acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
  },
  {
    id: 'france',
    name: 'France',
    country: 'France',
    countryCode: 'FR',
    userAgents: getPlatformUserAgents(),
    timezone: 'Europe/Paris',
    timezoneOffset: 60,
    language: 'fr-FR',
    languages: ['fr-FR', 'fr', 'en'],
    locale: 'fr-FR',
    geolocation: { latitude: 48.8566, longitude: 2.3522, accuracy: 100 }, // Paris
    acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8',
  },
  {
    id: 'russia',
    name: 'Russia',
    country: 'Russia',
    countryCode: 'RU',
    userAgents: getPlatformUserAgents(),
    timezone: 'Europe/Moscow',
    timezoneOffset: 180,
    language: 'ru-RU',
    languages: ['ru-RU', 'ru', 'en'],
    locale: 'ru-RU',
    geolocation: { latitude: 55.7558, longitude: 37.6173, accuracy: 100 }, // Moscow
    acceptLanguage: 'ru-RU,ru;q=0.9,en;q=0.8',
  },
  {
    id: 'japan',
    name: 'Japan',
    country: 'Japan',
    countryCode: 'JP',
    userAgents: getPlatformUserAgents(),
    timezone: 'Asia/Tokyo',
    timezoneOffset: 540,
    language: 'ja-JP',
    languages: ['ja-JP', 'ja', 'en'],
    locale: 'ja-JP',
    geolocation: { latitude: 35.6762, longitude: 139.6503, accuracy: 100 }, // Tokyo
    acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8',
  },
  {
    id: 'australia',
    name: 'Australia',
    country: 'Australia',
    countryCode: 'AU',
    userAgents: getPlatformUserAgents(),
    timezone: 'Australia/Sydney',
    timezoneOffset: 660,
    language: 'en-AU',
    languages: ['en-AU', 'en'],
    locale: 'en-AU',
    geolocation: { latitude: -33.8688, longitude: 151.2093, accuracy: 100 }, // Sydney
    acceptLanguage: 'en-AU,en;q=0.9',
  },
  {
    id: 'canada',
    name: 'Canada',
    country: 'Canada',
    countryCode: 'CA',
    userAgents: getPlatformUserAgents(),
    timezone: 'America/Toronto',
    timezoneOffset: -300,
    language: 'en-CA',
    languages: ['en-CA', 'en', 'fr-CA'],
    locale: 'en-CA',
    geolocation: { latitude: 43.6532, longitude: -79.3832, accuracy: 100 }, // Toronto
    acceptLanguage: 'en-CA,en;q=0.9,fr-CA;q=0.8',
  },
  {
    id: 'brazil',
    name: 'Brazil',
    country: 'Brazil',
    countryCode: 'BR',
    userAgents: getPlatformUserAgents(),
    timezone: 'America/Sao_Paulo',
    timezoneOffset: -180,
    language: 'pt-BR',
    languages: ['pt-BR', 'pt', 'en'],
    locale: 'pt-BR',
    geolocation: { latitude: -23.5505, longitude: -46.6333, accuracy: 100 }, // Sao Paulo
    acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8',
  },
  {
    id: 'india',
    name: 'India',
    country: 'India',
    countryCode: 'IN',
    userAgents: getPlatformUserAgents(),
    timezone: 'Asia/Kolkata',
    timezoneOffset: 330,
    language: 'en-IN',
    languages: ['en-IN', 'hi-IN', 'en'],
    locale: 'en-IN',
    geolocation: { latitude: 19.0760, longitude: 72.8777, accuracy: 100 }, // Mumbai
    acceptLanguage: 'en-IN,en;q=0.9,hi;q=0.8',
  },
  {
    id: 'singapore',
    name: 'Singapore',
    country: 'Singapore',
    countryCode: 'SG',
    userAgents: getPlatformUserAgents(),
    timezone: 'Asia/Singapore',
    timezoneOffset: 480,
    language: 'en-SG',
    languages: ['en-SG', 'en', 'zh-CN'],
    locale: 'en-SG',
    geolocation: { latitude: 1.3521, longitude: 103.8198, accuracy: 100 }, // Singapore
    acceptLanguage: 'en-SG,en;q=0.9,zh-CN;q=0.8',
  },
  {
    id: 'uae',
    name: 'United Arab Emirates',
    country: 'United Arab Emirates',
    countryCode: 'AE',
    userAgents: getPlatformUserAgents(),
    timezone: 'Asia/Dubai',
    timezoneOffset: 240,
    language: 'en-AE',
    languages: ['en-AE', 'ar-AE', 'en'],
    locale: 'en-AE',
    geolocation: { latitude: 25.2048, longitude: 55.2708, accuracy: 100 }, // Dubai
    acceptLanguage: 'en-AE,en;q=0.9,ar;q=0.8',
  },
  {
    id: 'south-africa',
    name: 'South Africa',
    country: 'South Africa',
    countryCode: 'ZA',
    userAgents: getPlatformUserAgents(),
    timezone: 'Africa/Johannesburg',
    timezoneOffset: 120,
    language: 'en-ZA',
    languages: ['en-ZA', 'en'],
    locale: 'en-ZA',
    geolocation: { latitude: -26.2041, longitude: 28.0473, accuracy: 100 }, // Johannesburg
    acceptLanguage: 'en-ZA,en;q=0.9',
  },
];

/**
 * Get region by ID
 */
export function getRegion(regionId: string): RegionConfig | undefined {
  return REGIONS.find(r => r.id === regionId);
}

/**
 * Get default region (US East)
 */
export function getDefaultRegion(): RegionConfig {
  return REGIONS[0];
}

/**
 * Get random user agent for region
 */
export function getRandomUserAgent(region: RegionConfig): string {
  const agents = region.userAgents;
  return agents[Math.floor(Math.random() * agents.length)];
}

/**
 * Add slight variation to geolocation (to avoid exact matches)
 */
export function getVariedGeolocation(region: RegionConfig): {
  latitude: number;
  longitude: number;
  accuracy: number;
} {
  // Add small random offset (within ~5km)
  const latOffset = (Math.random() - 0.5) * 0.1;
  const lonOffset = (Math.random() - 0.5) * 0.1;

  return {
    latitude: region.geolocation.latitude + latOffset,
    longitude: region.geolocation.longitude + lonOffset,
    accuracy: region.geolocation.accuracy + Math.floor(Math.random() * 50),
  };
}

/**
 * Current selected region (stored globally)
 */
let currentRegion: RegionConfig = getDefaultRegion();

export function setCurrentRegion(regionId: string): boolean {
  const region = getRegion(regionId);
  if (region) {
    currentRegion = region;
    logger.info('Region set', { regionId, name: region.name });
    return true;
  }
  return false;
}

export function getCurrentRegion(): RegionConfig {
  return currentRegion;
}

/**
 * Get all available regions for UI
 */
export function getAllRegions(): Array<{ id: string; name: string; country: string }> {
  return REGIONS.map(r => ({
    id: r.id,
    name: r.name,
    country: r.country,
  }));
}


