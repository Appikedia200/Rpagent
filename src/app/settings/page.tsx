'use client';

import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Shield,
  Database,
  Bell,
  Globe,
  Zap,
  HardDrive,
  Key,
  Check,
  Loader2,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Available regions - "auto" detects from proxy/IP automatically
const REGIONS = [
  { id: 'auto', name: 'Auto-Detect from Proxy/IP (Recommended)', flag: '🌐' },
  { id: 'us-east', name: 'United States (East)', flag: '🇺🇸' },
  { id: 'us-west', name: 'United States (West)', flag: '🇺🇸' },
  { id: 'us-central', name: 'United States (Central)', flag: '🇺🇸' },
  { id: 'uk', name: 'United Kingdom', flag: '🇬🇧' },
  { id: 'germany', name: 'Germany', flag: '🇩🇪' },
  { id: 'france', name: 'France', flag: '🇫🇷' },
  { id: 'russia', name: 'Russia', flag: '🇷🇺' },
  { id: 'japan', name: 'Japan', flag: '🇯🇵' },
  { id: 'australia', name: 'Australia', flag: '🇦🇺' },
  { id: 'canada', name: 'Canada', flag: '🇨🇦' },
  { id: 'brazil', name: 'Brazil', flag: '🇧🇷' },
  { id: 'india', name: 'India', flag: '🇮🇳' },
  { id: 'singapore', name: 'Singapore', flag: '🇸🇬' },
  { id: 'uae', name: 'United Arab Emirates', flag: '🇦🇪' },
  { id: 'south-africa', name: 'South Africa', flag: '🇿🇦' },
] as const;

// Settings type
interface SettingsState {
  // General
  maxConcurrentBrowsers: string;
  defaultTimeout: string;
  headlessMode: boolean;
  autoSave: boolean;
  
  // Anti-Detection
  region: string;
  humanBehavior: boolean;
  undetectableMode: boolean;
  blockWebRTC: boolean;
  
  // Proxy
  enableProxy: boolean;
  proxyRotation: string;
  
  // Notifications
  taskComplete: boolean;
  taskError: boolean;
  systemAlerts: boolean;
  
  // Storage
  dataRetention: string;
  autoCleanup: boolean;
  
  // CAPTCHA
  captchaService: string;
  captchaApiKey: string;
}

// Initial settings
const DEFAULT_SETTINGS: SettingsState = {
  // General
  maxConcurrentBrowsers: '10',
  defaultTimeout: '30000',
  headlessMode: false,
  autoSave: true,
  
  // Anti-Detection
  region: 'auto',
  humanBehavior: true,
  undetectableMode: true,
  blockWebRTC: true,
  
  // Proxy
  enableProxy: false,
  proxyRotation: 'session',
  
  // Notifications
  taskComplete: true,
  taskError: true,
  systemAlerts: true,
  
  // Storage
  dataRetention: '30',
  autoCleanup: true,
  
  // CAPTCHA
  captchaService: 'none',
  captchaApiKey: '',
};

// Memoized setting row component
const SettingSwitch = memo(function SettingSwitch({ 
  label, 
  description, 
  checked, 
  onChange 
}: { 
  label: string; 
  description: string; 
  checked: boolean; 
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label>{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
});

function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [captchaVerifying, setCaptchaVerifying] = useState(false);
  const [captchaVerified, setCaptchaVerified] = useState<boolean | null>(null);
  const [captchaBalance, setCaptchaBalance] = useState<number | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const result = await window.electron.invoke<{ success: boolean; settings: Record<string, unknown> }>(
          'settings:getAll'
        );
        if (result.success && result.settings) {
          setSettings({
            ...DEFAULT_SETTINGS,
            // Map each setting with proper type conversion
            maxConcurrentBrowsers: String(result.settings.maxConcurrentBrowsers ?? 10),
            defaultTimeout: String(result.settings.defaultTimeout ?? 30000),
            dataRetention: String(result.settings.dataRetention ?? 30),
            headlessMode: Boolean(result.settings.headlessMode ?? false),
            autoSave: Boolean(result.settings.autoSave ?? true),
            region: String(result.settings.region ?? 'auto'),
            humanBehavior: Boolean(result.settings.humanBehavior ?? true),
            undetectableMode: Boolean(result.settings.undetectableMode ?? true),
            blockWebRTC: Boolean(result.settings.blockWebRTC ?? true),
            enableProxy: Boolean(result.settings.enableProxy ?? false),
            proxyRotation: String(result.settings.proxyRotation ?? 'session'),
            taskComplete: Boolean(result.settings.taskComplete ?? true),
            taskError: Boolean(result.settings.taskError ?? true),
            systemAlerts: Boolean(result.settings.systemAlerts ?? true),
            autoCleanup: Boolean(result.settings.autoCleanup ?? true),
            captchaService: String(result.settings.captchaService ?? 'none'),
            captchaApiKey: String(result.settings.captchaApiKey ?? ''),
          });
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Memoized update function
  const updateSetting = useCallback((key: string, value: string | boolean) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
    setSaved(false);
    // Reset verification when service or key changes
    if (key === 'captchaService' || key === 'captchaApiKey') {
      setCaptchaVerified(null);
      setCaptchaBalance(null);
      setCaptchaError(null);
    }
  }, []);

  // Save settings
  const handleSaveSettings = useCallback(async () => {
    setSaving(true);
    try {
      // Convert string values to numbers for database
      const settingsToSave = {
        ...settings,
        maxConcurrentBrowsers: parseInt(settings.maxConcurrentBrowsers, 10) || 10,
        defaultTimeout: parseInt(settings.defaultTimeout, 10) || 30000,
        dataRetention: parseInt(settings.dataRetention, 10) || 30,
      };
      
      const result = await window.electron.invoke<{ success: boolean; error?: string }>(
        'settings:save',
        settingsToSave
      );
      
      if (result.success) {
        setSaved(true);
        setHasChanges(false);
        // Auto-hide saved indicator after 3 seconds
        setTimeout(() => setSaved(false), 3000);
      } else {
        console.error('Failed to save settings:', result.error);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  // Reset to defaults
  const handleResetDefaults = useCallback(async () => {
    try {
      const result = await window.electron.invoke<{ success: boolean; settings: Record<string, unknown> }>(
        'settings:reset'
      );
      if (result.success) {
        setSettings({ ...DEFAULT_SETTINGS });
        setHasChanges(false);
        setSaved(false);
        setCaptchaVerified(null);
        setCaptchaBalance(null);
        setCaptchaError(null);
      }
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
  }, []);

  // Verify captcha API key
  const handleVerifyCaptcha = useCallback(async () => {
    if (!settings.captchaApiKey || settings.captchaService === 'none') return;
    
    setCaptchaVerifying(true);
    setCaptchaVerified(null);
    setCaptchaError(null);
    
    try {
      // Map service name to expected format
      const serviceMap: Record<string, string> = {
        '2captcha': '2captcha',
        'anticaptcha': 'anti-captcha',
        'capsolver': 'capmonster',
      };
      
      const result = await window.electron.invoke<{ valid: boolean; balance?: number; error?: string }>(
        'captcha:verify',
        {
          service: serviceMap[settings.captchaService] || '2captcha',
          apiKey: settings.captchaApiKey,
        }
      );
      
      setCaptchaVerified(result.valid);
      if (result.balance !== undefined) {
        setCaptchaBalance(result.balance);
      }
      if (result.error) {
        setCaptchaError(result.error);
      }
    } catch (error) {
      console.error('Captcha verification failed:', error);
      setCaptchaVerified(false);
      setCaptchaError(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setCaptchaVerifying(false);
    }
  }, [settings.captchaApiKey, settings.captchaService]);

  // Memoized handlers for switches
  const handleHeadlessMode = useCallback((v: boolean) => updateSetting('headlessMode', v), [updateSetting]);
  const handleAutoSave = useCallback((v: boolean) => updateSetting('autoSave', v), [updateSetting]);
  const handleHumanBehavior = useCallback((v: boolean) => updateSetting('humanBehavior', v), [updateSetting]);
  const handleUndetectableMode = useCallback((v: boolean) => updateSetting('undetectableMode', v), [updateSetting]);
  const handleBlockWebRTC = useCallback((v: boolean) => updateSetting('blockWebRTC', v), [updateSetting]);
  const handleEnableProxy = useCallback((v: boolean) => updateSetting('enableProxy', v), [updateSetting]);
  const handleAutoCleanup = useCallback((v: boolean) => updateSetting('autoCleanup', v), [updateSetting]);
  const handleTaskComplete = useCallback((v: boolean) => updateSetting('taskComplete', v), [updateSetting]);
  const handleTaskError = useCallback((v: boolean) => updateSetting('taskError', v), [updateSetting]);
  const handleSystemAlerts = useCallback((v: boolean) => updateSetting('systemAlerts', v), [updateSetting]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Configure application preferences and automation settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleResetDefaults} disabled={loading}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button 
            onClick={handleSaveSettings} 
            disabled={loading || saving || !hasChanges}
            className={saved ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : saved ? (
              <Check className="h-4 w-4 mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-6 gap-2">
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">General</span>
          </TabsTrigger>
          <TabsTrigger value="antidetection" className="gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Anti-Detection</span>
          </TabsTrigger>
          <TabsTrigger value="proxy" className="gap-2">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">Proxy</span>
          </TabsTrigger>
          <TabsTrigger value="captcha" className="gap-2">
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">CAPTCHA</span>
          </TabsTrigger>
          <TabsTrigger value="storage" className="gap-2">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Storage</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Configure basic application behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="maxBrowsers">Max Concurrent Browsers</Label>
                  <Input
                    id="maxBrowsers"
                    type="number"
                    defaultValue={settings.maxConcurrentBrowsers}
                    onBlur={(e) => updateSetting('maxConcurrentBrowsers', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of browsers running simultaneously
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Default Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    defaultValue={settings.defaultTimeout}
                    onBlur={(e) => updateSetting('defaultTimeout', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default timeout for page operations
                  </p>
                </div>
              </div>
              <div className="space-y-4">
                <SettingSwitch
                  label="Headless Mode"
                  description="Run browsers without visible UI (faster)"
                  checked={settings.headlessMode}
                  onChange={handleHeadlessMode}
                />
                <SettingSwitch
                  label="Auto-Save"
                  description="Automatically save workflow progress"
                  checked={settings.autoSave}
                  onChange={handleAutoSave}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Anti-Detection Settings */}
        <TabsContent value="antidetection">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-accent" />
                Anti-Detection Settings
              </CardTitle>
              <CardDescription>
                Configure region, stealth, and fingerprint settings for undetectable browsing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Region Selection - IMPORTANT */}
              <div className="space-y-2 p-4 border rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10">
                <Label className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Region / Location
                </Label>
                <p className="text-sm text-muted-foreground mb-3">
                  {settings.region === 'auto' 
                    ? 'Auto-detect will fetch timezone, language, and location from your proxy IP (or actual IP if no proxy).'
                    : 'Manual override: Forces specific region settings regardless of proxy location.'
                  }
                </p>
                <Select
                  value={settings.region}
                  onValueChange={(v) => updateSetting('region', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select region..." />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(region => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.flag} {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className={`text-xs mt-2 ${settings.region === 'auto' ? 'text-blue-400' : 'text-green-500'}`}>
                  {settings.region === 'auto' 
                    ? '🌐 Timezone, Language, and Geolocation will be detected automatically from IP'
                    : '✓ User Agent, Timezone, Language, and Geolocation will match this region'
                  }
                </p>
              </div>

              <div className="space-y-4">
                <SettingSwitch
                  label="Undetectable Mode"
                  description="Apply comprehensive anti-detection patches (passes browserscan.net, Cloudflare)"
                  checked={settings.undetectableMode}
                  onChange={handleUndetectableMode}
                />
                <SettingSwitch
                  label="Human Behavior Simulation"
                  description="Simulate realistic mouse movements, typing patterns, and reading delays"
                  checked={settings.humanBehavior}
                  onChange={handleHumanBehavior}
                />
                <SettingSwitch
                  label="Block WebRTC"
                  description="Prevent IP leaks through WebRTC connections"
                  checked={settings.blockWebRTC}
                  onChange={handleBlockWebRTC}
                />
              </div>

              {/* Info Box */}
              <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <h4 className="font-semibold text-green-400 mb-2">🛡️ Anti-Detection Features Active</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Real Chrome user agents (latest stable versions)</li>
                  <li>• Consistent timezone matching selected region</li>
                  <li>• Real browser fingerprints (Canvas, WebGL, Audio)</li>
                  <li>• Automation flags removed (navigator.webdriver)</li>
                  <li>• Chrome object properly configured</li>
                  <li>• Plugins and permissions match real browsers</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Proxy Settings */}
        <TabsContent value="proxy">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Proxy Settings
              </CardTitle>
              <CardDescription>
                Configure proxy routing behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingSwitch
                label="Enable Proxy"
                description="Route browser traffic through proxies"
                checked={settings.enableProxy}
                onChange={handleEnableProxy}
              />
              <div className="space-y-2">
                <Label>Proxy Rotation</Label>
                <Select
                  defaultValue={settings.proxyRotation}
                  onValueChange={(v) => updateSetting('proxyRotation', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Rotation</SelectItem>
                    <SelectItem value="session">Per Session</SelectItem>
                    <SelectItem value="request">Per Request</SelectItem>
                    <SelectItem value="time">Time-Based (5 min)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often to rotate to a new proxy
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAPTCHA Settings */}
        <TabsContent value="captcha">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                CAPTCHA Solving
              </CardTitle>
              <CardDescription>
                Configure automatic CAPTCHA solving service
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>CAPTCHA Service</Label>
                <Select
                  defaultValue={settings.captchaService}
                  onValueChange={(v) => updateSetting('captchaService', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Disabled</SelectItem>
                    <SelectItem value="2captcha">2Captcha</SelectItem>
                    <SelectItem value="anticaptcha">Anti-Captcha</SelectItem>
                    <SelectItem value="capsolver">CapSolver</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.captchaService !== 'none' && (
                <div className="space-y-2">
                  <Label htmlFor="captchaKey">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="captchaKey"
                        type="password"
                        placeholder="Enter your API key"
                        value={settings.captchaApiKey}
                        onChange={(e) => updateSetting('captchaApiKey', e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    <Button 
                      variant={captchaVerified ? 'default' : 'outline'}
                      onClick={handleVerifyCaptcha}
                      disabled={captchaVerifying || !settings.captchaApiKey}
                      className={captchaVerified ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {captchaVerifying ? 'Verifying...' : captchaVerified ? '✓ Verified' : 'Verify'}
                    </Button>
                  </div>
                  {captchaVerified && captchaBalance !== null && (
                    <p className="text-sm text-green-500">
                      ✓ API key valid. Balance: ${captchaBalance.toFixed(2)}
                    </p>
                  )}
                  {captchaVerified === false && captchaError && (
                    <p className="text-sm text-red-500">
                      ✗ {captchaError}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Storage Settings */}
        <TabsContent value="storage">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Storage Settings
              </CardTitle>
              <CardDescription>
                Configure data storage and cleanup
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="retention">Data Retention (days)</Label>
                <Input
                  id="retention"
                  type="number"
                  defaultValue={settings.dataRetention}
                  onBlur={(e) => updateSetting('dataRetention', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  How long to keep task history and logs
                </p>
              </div>
              <SettingSwitch
                label="Auto Cleanup"
                description="Automatically remove old data"
                checked={settings.autoCleanup}
                onChange={handleAutoCleanup}
              />
              <div className="pt-4 border-t">
                <Button variant="destructive" className="w-full">
                  Clear All Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <SettingSwitch
                label="Task Complete"
                description="Notify when tasks finish successfully"
                checked={settings.taskComplete}
                onChange={handleTaskComplete}
              />
              <SettingSwitch
                label="Task Errors"
                description="Notify when tasks encounter errors"
                checked={settings.taskError}
                onChange={handleTaskError}
              />
              <SettingSwitch
                label="System Alerts"
                description="Important system notifications"
                checked={settings.systemAlerts}
                onChange={handleSystemAlerts}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default memo(SettingsPage);
