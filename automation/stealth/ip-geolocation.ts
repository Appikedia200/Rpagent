/**
 * @fileoverview IP Geolocation Service
 * @module automation/stealth/ip-geolocation
 *
 * Dynamically detects timezone, location, and other geo data from IP.
 * Uses multiple free APIs for reliability.
 *
 * This is CRITICAL for anti-detection:
 * - Timezone MUST match the proxy's IP location
 * - Language preferences should match the region
 * - Geolocation should be consistent
 */

import { logger } from '../../electron/utils/logger';

/**
 * Geolocation data from IP detection
 */
export interface IPGeolocationData {
  ip: string;
  country: string;
  countryCode: string;
  region: string;
  city: string;
  timezone: string;
  timezoneOffset: number; // minutes from UTC
  latitude: number;
  longitude: number;
  isp: string;
  org: string;
  // Derived from location
  language: string;
  languages: string[];
  locale: string;
  acceptLanguage: string;
  // Detection info
  detectedAt: string;
  source: string;
}

/**
 * Language mappings by country code
 */
const COUNTRY_LANGUAGES: Record<string, { language: string; languages: string[]; locale: string; acceptLanguage: string }> = {
  US: { language: 'en-US', languages: ['en-US', 'en'], locale: 'en-US', acceptLanguage: 'en-US,en;q=0.9' },
  GB: { language: 'en-GB', languages: ['en-GB', 'en'], locale: 'en-GB', acceptLanguage: 'en-GB,en;q=0.9' },
  CA: { language: 'en-CA', languages: ['en-CA', 'en', 'fr-CA'], locale: 'en-CA', acceptLanguage: 'en-CA,en;q=0.9,fr-CA;q=0.8' },
  AU: { language: 'en-AU', languages: ['en-AU', 'en'], locale: 'en-AU', acceptLanguage: 'en-AU,en;q=0.9' },
  DE: { language: 'de-DE', languages: ['de-DE', 'de', 'en'], locale: 'de-DE', acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8' },
  FR: { language: 'fr-FR', languages: ['fr-FR', 'fr', 'en'], locale: 'fr-FR', acceptLanguage: 'fr-FR,fr;q=0.9,en;q=0.8' },
  ES: { language: 'es-ES', languages: ['es-ES', 'es', 'en'], locale: 'es-ES', acceptLanguage: 'es-ES,es;q=0.9,en;q=0.8' },
  IT: { language: 'it-IT', languages: ['it-IT', 'it', 'en'], locale: 'it-IT', acceptLanguage: 'it-IT,it;q=0.9,en;q=0.8' },
  PT: { language: 'pt-PT', languages: ['pt-PT', 'pt', 'en'], locale: 'pt-PT', acceptLanguage: 'pt-PT,pt;q=0.9,en;q=0.8' },
  BR: { language: 'pt-BR', languages: ['pt-BR', 'pt', 'en'], locale: 'pt-BR', acceptLanguage: 'pt-BR,pt;q=0.9,en;q=0.8' },
  RU: { language: 'ru-RU', languages: ['ru-RU', 'ru', 'en'], locale: 'ru-RU', acceptLanguage: 'ru-RU,ru;q=0.9,en;q=0.8' },
  JP: { language: 'ja-JP', languages: ['ja-JP', 'ja', 'en'], locale: 'ja-JP', acceptLanguage: 'ja-JP,ja;q=0.9,en;q=0.8' },
  CN: { language: 'zh-CN', languages: ['zh-CN', 'zh', 'en'], locale: 'zh-CN', acceptLanguage: 'zh-CN,zh;q=0.9,en;q=0.8' },
  KR: { language: 'ko-KR', languages: ['ko-KR', 'ko', 'en'], locale: 'ko-KR', acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.8' },
  IN: { language: 'en-IN', languages: ['en-IN', 'hi-IN', 'en'], locale: 'en-IN', acceptLanguage: 'en-IN,en;q=0.9,hi;q=0.8' },
  NL: { language: 'nl-NL', languages: ['nl-NL', 'nl', 'en'], locale: 'nl-NL', acceptLanguage: 'nl-NL,nl;q=0.9,en;q=0.8' },
  PL: { language: 'pl-PL', languages: ['pl-PL', 'pl', 'en'], locale: 'pl-PL', acceptLanguage: 'pl-PL,pl;q=0.9,en;q=0.8' },
  TR: { language: 'tr-TR', languages: ['tr-TR', 'tr', 'en'], locale: 'tr-TR', acceptLanguage: 'tr-TR,tr;q=0.9,en;q=0.8' },
  SA: { language: 'ar-SA', languages: ['ar-SA', 'ar', 'en'], locale: 'ar-SA', acceptLanguage: 'ar-SA,ar;q=0.9,en;q=0.8' },
  AE: { language: 'ar-AE', languages: ['ar-AE', 'ar', 'en'], locale: 'ar-AE', acceptLanguage: 'ar-AE,ar;q=0.9,en;q=0.8' },
  SG: { language: 'en-SG', languages: ['en-SG', 'zh-CN', 'en'], locale: 'en-SG', acceptLanguage: 'en-SG,en;q=0.9,zh-CN;q=0.8' },
  ZA: { language: 'en-ZA', languages: ['en-ZA', 'en'], locale: 'en-ZA', acceptLanguage: 'en-ZA,en;q=0.9' },
  MX: { language: 'es-MX', languages: ['es-MX', 'es', 'en'], locale: 'es-MX', acceptLanguage: 'es-MX,es;q=0.9,en;q=0.8' },
  AR: { language: 'es-AR', languages: ['es-AR', 'es', 'en'], locale: 'es-AR', acceptLanguage: 'es-AR,es;q=0.9,en;q=0.8' },
  UA: { language: 'uk-UA', languages: ['uk-UA', 'uk', 'ru', 'en'], locale: 'uk-UA', acceptLanguage: 'uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7' },
  TH: { language: 'th-TH', languages: ['th-TH', 'th', 'en'], locale: 'th-TH', acceptLanguage: 'th-TH,th;q=0.9,en;q=0.8' },
  VN: { language: 'vi-VN', languages: ['vi-VN', 'vi', 'en'], locale: 'vi-VN', acceptLanguage: 'vi-VN,vi;q=0.9,en;q=0.8' },
  ID: { language: 'id-ID', languages: ['id-ID', 'id', 'en'], locale: 'id-ID', acceptLanguage: 'id-ID,id;q=0.9,en;q=0.8' },
  PH: { language: 'en-PH', languages: ['en-PH', 'tl-PH', 'en'], locale: 'en-PH', acceptLanguage: 'en-PH,en;q=0.9,tl;q=0.8' },
  MY: { language: 'ms-MY', languages: ['ms-MY', 'en-MY', 'en'], locale: 'ms-MY', acceptLanguage: 'ms-MY,ms;q=0.9,en;q=0.8' },
};

/**
 * Get language info for country code
 */
function getLanguageInfo(countryCode: string): { language: string; languages: string[]; locale: string; acceptLanguage: string } {
  return COUNTRY_LANGUAGES[countryCode] || COUNTRY_LANGUAGES['US'];
}

/**
 * Calculate timezone offset from timezone string
 */
function calculateTimezoneOffset(timezone: string): number {
  try {
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    
    // Create a date in the target timezone
    const targetDate = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const targetTime = targetDate.getTime();
    
    // Calculate offset in minutes
    const offset = (targetTime - utcTime) / 60000;
    return Math.round(offset);
  } catch {
    return 0; // UTC if can't calculate
  }
}

/**
 * Detect geolocation from IP using ip-api.com (free, no API key needed)
 */
async function detectFromIpApi(proxyAgent?: unknown): Promise<IPGeolocationData | null> {
  try {
    const response = await fetch('http://ip-api.com/json/?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,query', {
      // @ts-ignore - proxy agent type
      agent: proxyAgent,
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.status !== 'success') return null;

    const langInfo = getLanguageInfo(data.countryCode);
    const timezoneOffset = calculateTimezoneOffset(data.timezone);

    return {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      timezone: data.timezone,
      timezoneOffset,
      latitude: data.lat,
      longitude: data.lon,
      isp: data.isp,
      org: data.org,
      ...langInfo,
      detectedAt: new Date().toISOString(),
      source: 'ip-api.com',
    };
  } catch (error) {
    logger.warn('ip-api.com detection failed', { error });
    return null;
  }
}

/**
 * Detect geolocation from IP using ipinfo.io (free tier available)
 */
async function detectFromIpInfo(proxyAgent?: unknown): Promise<IPGeolocationData | null> {
  try {
    const response = await fetch('https://ipinfo.io/json', {
      // @ts-ignore - proxy agent type
      agent: proxyAgent,
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    // Parse location string (e.g., "37.7749,-122.4194")
    const [lat, lon] = (data.loc || '0,0').split(',').map(Number);
    
    const langInfo = getLanguageInfo(data.country);
    const timezoneOffset = calculateTimezoneOffset(data.timezone || 'UTC');

    return {
      ip: data.ip,
      country: data.country,
      countryCode: data.country,
      region: data.region,
      city: data.city,
      timezone: data.timezone || 'UTC',
      timezoneOffset,
      latitude: lat,
      longitude: lon,
      isp: data.org || '',
      org: data.org || '',
      ...langInfo,
      detectedAt: new Date().toISOString(),
      source: 'ipinfo.io',
    };
  } catch (error) {
    logger.warn('ipinfo.io detection failed', { error });
    return null;
  }
}

/**
 * Detect geolocation from IP using ipwhois.app (free, no API key needed)
 */
async function detectFromIpWhois(proxyAgent?: unknown): Promise<IPGeolocationData | null> {
  try {
    const response = await fetch('https://ipwhois.app/json/', {
      // @ts-ignore - proxy agent type
      agent: proxyAgent,
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.success) return null;

    const langInfo = getLanguageInfo(data.country_code);
    const timezoneOffset = calculateTimezoneOffset(data.timezone);

    return {
      ip: data.ip,
      country: data.country,
      countryCode: data.country_code,
      region: data.region,
      city: data.city,
      timezone: data.timezone,
      timezoneOffset,
      latitude: data.latitude,
      longitude: data.longitude,
      isp: data.isp,
      org: data.org,
      ...langInfo,
      detectedAt: new Date().toISOString(),
      source: 'ipwhois.app',
    };
  } catch (error) {
    logger.warn('ipwhois.app detection failed', { error });
    return null;
  }
}

/**
 * Cache for geolocation data
 */
const geoCache = new Map<string, IPGeolocationData>();

/**
 * Global cached geolocation (detected once per session)
 */
let globalGeoCache: IPGeolocationData | null = null;
let geoDetectionPromise: Promise<IPGeolocationData> | null = null;

/**
 * Detect geolocation from current IP (or proxy IP if using proxy)
 * Uses CACHING to avoid repeated API calls
 * Uses timeout to prevent hanging
 */
export async function detectIPGeolocation(proxyAgent?: unknown): Promise<IPGeolocationData> {
  // Return cached result if available (fast path)
  if (globalGeoCache && !proxyAgent) {
    logger.debug('Using cached IP geolocation', { ip: globalGeoCache.ip });
    return globalGeoCache;
  }

  // If detection is already in progress, wait for it
  if (geoDetectionPromise && !proxyAgent) {
    return geoDetectionPromise;
  }

  // Start detection with timeout
  geoDetectionPromise = detectWithTimeout(proxyAgent);
  
  try {
    const result = await geoDetectionPromise;
    if (!proxyAgent) {
      globalGeoCache = result;
    }
    return result;
  } finally {
    geoDetectionPromise = null;
  }
}

/**
 * Detection with timeout (3 seconds max)
 */
async function detectWithTimeout(proxyAgent?: unknown): Promise<IPGeolocationData> {
  const timeoutMs = 3000; // 3 second timeout
  
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => resolve(null), timeoutMs);
  });

  // Try APIs in parallel for speed, use first success
  const apiPromises = [
    detectFromIpApi(proxyAgent),
    detectFromIpWhois(proxyAgent),
    detectFromIpInfo(proxyAgent),
  ];

  try {
    // Race between APIs and timeout
    const result = await Promise.race([
      Promise.any(apiPromises),
      timeoutPromise,
    ]);

    if (result) {
      logger.info('IP geolocation detected', {
        ip: result.ip,
        country: result.country,
        timezone: result.timezone,
        source: result.source,
      });
      
      geoCache.set(result.ip, result);
      return result;
    }
  } catch (error) {
    logger.warn('All geolocation APIs failed', { error });
  }

  // Fallback to default
  logger.warn('Using default geolocation (detection failed or timed out)');
  return getDefaultGeolocation();
}

/**
 * Get cached geolocation for an IP
 */
export function getCachedGeolocation(ip: string): IPGeolocationData | undefined {
  return geoCache.get(ip);
}

/**
 * Default geolocation (US East Coast)
 */
export function getDefaultGeolocation(): IPGeolocationData {
  return {
    ip: 'unknown',
    country: 'United States',
    countryCode: 'US',
    region: 'New York',
    city: 'New York',
    timezone: 'America/New_York',
    timezoneOffset: -300,
    latitude: 40.7128,
    longitude: -74.0060,
    isp: 'Unknown',
    org: 'Unknown',
    language: 'en-US',
    languages: ['en-US', 'en'],
    locale: 'en-US',
    acceptLanguage: 'en-US,en;q=0.9',
    detectedAt: new Date().toISOString(),
    source: 'default',
  };
}

/**
 * Add slight variation to coordinates (to avoid exact matches)
 */
export function addGeolocationVariation(geo: IPGeolocationData): {
  latitude: number;
  longitude: number;
  accuracy: number;
} {
  // Add small random offset (within ~1-5km)
  const latOffset = (Math.random() - 0.5) * 0.05;
  const lonOffset = (Math.random() - 0.5) * 0.05;

  return {
    latitude: geo.latitude + latOffset,
    longitude: geo.longitude + lonOffset,
    accuracy: 50 + Math.floor(Math.random() * 100), // 50-150m accuracy
  };
}

