'use client';

import * as React from 'react';
import {
  Play,
  Search,
  Settings,
  Star,
  Clock,
  Users,
  Mail,
  Youtube,
  Globe,
  FileText,
  Activity,
  Camera,
  Lock,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: number;
  estimatedTime: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  rating: number;
  uses: number;
  tags: string[];
  icon: string;
  parameters: TemplateParameter[];
}

interface TemplateParameter {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean';
  default?: string | number | boolean;
  required?: boolean;
  options?: string[];
  description?: string;
}

const TEMPLATES: Template[] = [
  {
    id: 'gmail-signup',
    name: 'Gmail Account Creation',
    description: 'Create Gmail accounts with random or specified details. Handles CAPTCHA and phone verification.',
    category: 'Account Creation',
    steps: 10,
    estimatedTime: '2-5 min',
    difficulty: 'intermediate',
    rating: 4.8,
    uses: 1250,
    tags: ['gmail', 'google', 'email'],
    icon: 'mail',
    parameters: [
      { name: 'browserCount', label: 'Number of Browsers', type: 'number', default: 3, required: true, description: 'How many browsers to launch' },
      { name: 'firstName', label: 'First Name', type: 'text', default: '', description: 'Leave empty for random' },
      { name: 'lastName', label: 'Last Name', type: 'text', default: '', description: 'Leave empty for random' },
      { name: 'useCaptcha', label: 'Use 2Captcha', type: 'boolean', default: true, description: 'Auto-solve CAPTCHAs' },
    ],
  },
  {
    id: 'youtube-channel',
    name: 'YouTube Channel Creation',
    description: 'Create YouTube channels with custom branding. Requires an existing Google account.',
    category: 'Social Media',
    steps: 5,
    estimatedTime: '1-2 min',
    difficulty: 'beginner',
    rating: 4.6,
    uses: 890,
    tags: ['youtube', 'channel', 'video'],
    icon: 'youtube',
    parameters: [
      { name: 'browserCount', label: 'Number of Browsers', type: 'number', default: 1, required: true },
      { name: 'channelName', label: 'Channel Name', type: 'text', default: '', description: 'Leave empty for random' },
      { name: 'channelDescription', label: 'Channel Description', type: 'text', default: '' },
    ],
  },
  {
    id: 'ecommerce-scraper',
    name: 'E-commerce Product Scraper',
    description: 'Extract product data from e-commerce websites including title, price, description, and images.',
    category: 'Data Extraction',
    steps: 7,
    estimatedTime: '10-30 sec/page',
    difficulty: 'intermediate',
    rating: 4.5,
    uses: 567,
    tags: ['scraping', 'ecommerce', 'products'],
    icon: 'globe',
    parameters: [
      { name: 'url', label: 'Product URL', type: 'text', required: true, description: 'URL of the product page' },
      { name: 'pages', label: 'Number of Pages', type: 'number', default: 1 },
    ],
  },
  {
    id: 'form-autofill',
    name: 'Generic Form Auto-Fill',
    description: 'Automatically fill out any web form with provided or generated data.',
    category: 'Form Filling',
    steps: 4,
    estimatedTime: '10-30 sec',
    difficulty: 'beginner',
    rating: 4.7,
    uses: 1100,
    tags: ['form', 'autofill', 'data-entry'],
    icon: 'file',
    parameters: [
      { name: 'url', label: 'Form URL', type: 'text', required: true },
      { name: 'browserCount', label: 'Number of Browsers', type: 'number', default: 1 },
      { name: 'autoSubmit', label: 'Auto Submit', type: 'boolean', default: false },
    ],
  },
  {
    id: 'twitter-post',
    name: 'Twitter/X Post Creator',
    description: 'Automatically post tweets/threads on Twitter/X.',
    category: 'Social Media',
    steps: 5,
    estimatedTime: '30 sec',
    difficulty: 'beginner',
    rating: 4.4,
    uses: 432,
    tags: ['twitter', 'x', 'social'],
    icon: 'users',
    parameters: [
      { name: 'tweetText', label: 'Tweet Content', type: 'text', required: true },
      { name: 'browserCount', label: 'Number of Browsers', type: 'number', default: 1 },
    ],
  },
  {
    id: 'uptime-monitor',
    name: 'Website Uptime Monitor',
    description: 'Check if a website is accessible and measure response time.',
    category: 'Monitoring',
    steps: 6,
    estimatedTime: '5-10 sec',
    difficulty: 'beginner',
    rating: 4.9,
    uses: 789,
    tags: ['monitoring', 'uptime', 'health-check'],
    icon: 'activity',
    parameters: [
      { name: 'url', label: 'Website URL', type: 'text', required: true },
      { name: 'timeout', label: 'Timeout (seconds)', type: 'number', default: 30 },
    ],
  },
  {
    id: 'screenshot',
    name: 'Full Page Screenshot',
    description: 'Capture full-page screenshots of websites for archival or comparison.',
    category: 'Productivity',
    steps: 3,
    estimatedTime: '5-15 sec',
    difficulty: 'beginner',
    rating: 4.6,
    uses: 654,
    tags: ['screenshot', 'capture', 'archive'],
    icon: 'camera',
    parameters: [
      { name: 'url', label: 'Website URL', type: 'text', required: true },
      { name: 'fullPage', label: 'Full Page', type: 'boolean', default: true },
    ],
  },
  {
    id: 'login-automation',
    name: 'Generic Website Login',
    description: 'Automate login to any website with username/password authentication.',
    category: 'Productivity',
    steps: 6,
    estimatedTime: '10-20 sec',
    difficulty: 'beginner',
    rating: 4.8,
    uses: 1456,
    tags: ['login', 'auth', 'password'],
    icon: 'lock',
    parameters: [
      { name: 'url', label: 'Login Page URL', type: 'text', required: true },
      { name: 'username', label: 'Username/Email', type: 'text', required: true },
      { name: 'password', label: 'Password', type: 'text', required: true },
      { name: 'browserCount', label: 'Number of Browsers', type: 'number', default: 1 },
    ],
  },
];

const CATEGORIES = [
  { name: 'All Templates', count: TEMPLATES.length },
  { name: 'Account Creation', count: TEMPLATES.filter(t => t.category === 'Account Creation').length },
  { name: 'Social Media', count: TEMPLATES.filter(t => t.category === 'Social Media').length },
  { name: 'Data Extraction', count: TEMPLATES.filter(t => t.category === 'Data Extraction').length },
  { name: 'Form Filling', count: TEMPLATES.filter(t => t.category === 'Form Filling').length },
  { name: 'Monitoring', count: TEMPLATES.filter(t => t.category === 'Monitoring').length },
  { name: 'Productivity', count: TEMPLATES.filter(t => t.category === 'Productivity').length },
];

function getIcon(iconName: string) {
  switch (iconName) {
    case 'mail': return <Mail className="h-6 w-6" />;
    case 'youtube': return <Youtube className="h-6 w-6" />;
    case 'globe': return <Globe className="h-6 w-6" />;
    case 'file': return <FileText className="h-6 w-6" />;
    case 'users': return <Users className="h-6 w-6" />;
    case 'activity': return <Activity className="h-6 w-6" />;
    case 'camera': return <Camera className="h-6 w-6" />;
    case 'lock': return <Lock className="h-6 w-6" />;
    default: return <Settings className="h-6 w-6" />;
  }
}

function getDifficultyBadge(difficulty: Template['difficulty']) {
  switch (difficulty) {
    case 'beginner':
      return <Badge className="bg-green-500/20 text-green-400">beginner</Badge>;
    case 'intermediate':
      return <Badge className="bg-yellow-500/20 text-yellow-400">intermediate</Badge>;
    case 'advanced':
      return <Badge className="bg-red-500/20 text-red-400">advanced</Badge>;
  }
}

export default function TemplatesPage() {
  const [selectedCategory, setSelectedCategory] = React.useState('All Templates');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [configDialog, setConfigDialog] = React.useState<Template | null>(null);
  const [paramValues, setParamValues] = React.useState<Record<string, string | number | boolean>>({});
  const [running, setRunning] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const filteredTemplates = TEMPLATES.filter((template) => {
    const matchesCategory = selectedCategory === 'All Templates' || template.category === selectedCategory;
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const openConfigDialog = (template: Template) => {
    const defaults: Record<string, string | number | boolean> = {};
    template.parameters.forEach(p => {
      defaults[p.name] = p.default ?? (p.type === 'number' ? 1 : p.type === 'boolean' ? false : '');
    });
    setParamValues(defaults);
    setConfigDialog(template);
  };

  const runTemplate = async () => {
    if (!configDialog) return;
    
    setRunning(configDialog.id);
    setConfigDialog(null);

    try {
      // Build command based on template
      let command = '';
      const browserCount = paramValues.browserCount || 1;

      switch (configDialog.id) {
        case 'gmail-signup':
          command = `Launch ${browserCount} browsers and create Gmail accounts`;
          if (paramValues.firstName) command += ` with first name ${paramValues.firstName}`;
          break;
        case 'youtube-channel':
          command = `Launch ${browserCount} browsers and create YouTube channels`;
          if (paramValues.channelName) command += ` named ${paramValues.channelName}`;
          break;
        case 'ecommerce-scraper':
          command = `Open ${paramValues.url} and extract product data`;
          break;
        case 'form-autofill':
          command = `Launch ${browserCount} browsers, go to ${paramValues.url} and fill the form with random data`;
          if (paramValues.autoSubmit) command += ' then submit';
          break;
        case 'twitter-post':
          command = `Launch ${browserCount} browsers and post tweet: ${paramValues.tweetText}`;
          break;
        case 'uptime-monitor':
          command = `Navigate to ${paramValues.url} and check if it loads within ${paramValues.timeout || 30} seconds`;
          break;
        case 'screenshot':
          command = `Navigate to ${paramValues.url} and take a ${paramValues.fullPage ? 'full page' : ''} screenshot`;
          break;
        case 'login-automation':
          command = `Launch ${browserCount} browsers, go to ${paramValues.url}, login with username ${paramValues.username}`;
          break;
        default:
          command = `Run template ${configDialog.name}`;
      }

      // Execute the command
      await window.electron?.invoke('command:execute', command);
      
      setSuccess(configDialog.id);
      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error('Failed to run template:', error);
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="flex-1 flex">
      {/* Sidebar */}
      <div className="w-64 border-r bg-card/50 p-4">
        <h2 className="font-semibold mb-4">Categories</h2>
        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="space-y-1">
            {CATEGORIES.map((category) => (
              <button
                key={category.name}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors',
                  selectedCategory === category.name
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-secondary'
                )}
                onClick={() => setSelectedCategory(category.name)}
              >
                <span>{category.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {category.count}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Template Library</h1>
          <p className="text-muted-foreground">Pre-built automation workflows ready to use</p>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                'relative transition-all hover:shadow-lg cursor-pointer group',
                running === template.id && 'ring-2 ring-accent animate-pulse',
                success === template.id && 'ring-2 ring-green-500'
              )}
              onClick={() => openConfigDialog(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    'flex h-12 w-12 items-center justify-center rounded-lg',
                    'bg-accent/20 text-accent'
                  )}>
                    {running === template.id ? (
                      <Loader2 className="h-6 w-6 animate-spin" />
                    ) : success === template.id ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      getIcon(template.icon)
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {getDifficultyBadge(template.difficulty)}
                  </div>
                </div>
                <CardTitle className="text-lg mt-3 group-hover:text-accent transition-colors">
                  {template.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {template.description}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3 w-3" />
                    <span>{template.estimatedTime}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                    <span>{template.rating}</span>
                  </div>
                  <span>{template.uses.toLocaleString()} uses</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-3">
                  {template.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {template.tags.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{template.tags.length - 3}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={configDialog !== null} onOpenChange={(open) => !open && setConfigDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {configDialog && (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 text-accent">
                    {getIcon(configDialog.icon)}
                  </div>
                  {configDialog.name}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {configDialog?.description}
            </DialogDescription>
          </DialogHeader>
          
          {configDialog && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {configDialog.steps} steps
                </span>
                <span>•</span>
                <span>{configDialog.estimatedTime}</span>
                <span>•</span>
                {getDifficultyBadge(configDialog.difficulty)}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-4">Configuration</h4>
                <div className="space-y-4">
                  {configDialog.parameters.map((param) => (
                    <div key={param.name} className="space-y-2">
                      <Label>
                        {param.label}
                        {param.required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {param.type === 'text' && (
                        <Input
                          value={paramValues[param.name] as string || ''}
                          onChange={(e) => setParamValues({ ...paramValues, [param.name]: e.target.value })}
                          placeholder={param.description}
                        />
                      )}
                      {param.type === 'number' && (
                        <Input
                          type="number"
                          min={1}
                          value={paramValues[param.name] as number || 1}
                          onChange={(e) => setParamValues({ ...paramValues, [param.name]: parseInt(e.target.value) || 1 })}
                        />
                      )}
                      {param.type === 'boolean' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={param.name}
                            checked={paramValues[param.name] as boolean || false}
                            onChange={(e) => setParamValues({ ...paramValues, [param.name]: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <label htmlFor={param.name} className="text-sm text-muted-foreground">
                            {param.description}
                          </label>
                        </div>
                      )}
                      {param.description && param.type !== 'boolean' && (
                        <p className="text-xs text-muted-foreground">{param.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigDialog(null)}>
              Cancel
            </Button>
            <Button onClick={runTemplate}>
              <Play className="h-4 w-4 mr-2" />
              Run Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
