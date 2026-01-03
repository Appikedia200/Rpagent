'use client';

import * as React from 'react';
import {
  Plus,
  Play,
  Trash2,
  GripVertical,
  ChevronRight,
  Globe,
  MousePointer,
  Type,
  Clock,
  Camera,
  FileText,
  Code,
  CheckCircle2,
  X,
  Settings,
  Copy,
  Download,
  Upload,
  Loader2,
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// Step types matching the backend workflow engine
type StepType = 'NAVIGATE' | 'CLICK' | 'TYPE_TEXT' | 'WAIT' | 'SCREENSHOT' | 'SCROLL' | 'EXTRACT_DATA' | 'FILL_FORM' | 'EXECUTE_SCRIPT' | 'CONDITIONAL';

interface WorkflowStep {
  id: string;
  type: StepType;
  name: string;
  config: Record<string, unknown>;
}

interface Workflow {
  name: string;
  description: string;
  browserCount: number;
  steps: WorkflowStep[];
}

const STEP_TYPES: { type: StepType; name: string; icon: React.ReactNode; color: string; description: string }[] = [
  { type: 'NAVIGATE', name: 'Navigate', icon: <Globe className="h-4 w-4" />, color: 'bg-blue-500', description: 'Go to a URL' },
  { type: 'CLICK', name: 'Click', icon: <MousePointer className="h-4 w-4" />, color: 'bg-green-500', description: 'Click an element' },
  { type: 'TYPE_TEXT', name: 'Type Text', icon: <Type className="h-4 w-4" />, color: 'bg-purple-500', description: 'Enter text into a field' },
  { type: 'WAIT', name: 'Wait', icon: <Clock className="h-4 w-4" />, color: 'bg-yellow-500', description: 'Wait for time or element' },
  { type: 'SCREENSHOT', name: 'Screenshot', icon: <Camera className="h-4 w-4" />, color: 'bg-pink-500', description: 'Capture screenshot' },
  { type: 'EXTRACT_DATA', name: 'Extract Data', icon: <FileText className="h-4 w-4" />, color: 'bg-cyan-500', description: 'Extract data from page' },
  { type: 'EXECUTE_SCRIPT', name: 'Run Script', icon: <Code className="h-4 w-4" />, color: 'bg-orange-500', description: 'Execute JavaScript' },
  { type: 'FILL_FORM', name: 'Fill Form', icon: <CheckCircle2 className="h-4 w-4" />, color: 'bg-indigo-500', description: 'Auto-fill form fields' },
];

const DEFAULT_WORKFLOW: Workflow = {
  name: 'New Workflow',
  description: '',
  browserCount: 1,
  steps: [],
};

export default function WorkflowBuilderPage() {
  const [workflow, setWorkflow] = React.useState<Workflow>(DEFAULT_WORKFLOW);
  const [selectedStep, setSelectedStep] = React.useState<string | null>(null);
  const [addStepDialog, setAddStepDialog] = React.useState(false);
  const [settingsDialog, setSettingsDialog] = React.useState(false);
  const [running, setRunning] = React.useState(false);
  const [runStatus, setRunStatus] = React.useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [draggedStep, setDraggedStep] = React.useState<string | null>(null);

  const selectedStepData = workflow.steps.find(s => s.id === selectedStep);

  const addStep = (type: StepType) => {
    const stepInfo = STEP_TYPES.find(s => s.type === type);
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      type,
      name: stepInfo?.name || type,
      config: getDefaultConfig(type),
    };
    setWorkflow(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
    }));
    setAddStepDialog(false);
    setSelectedStep(newStep.id);
  };

  const getDefaultConfig = (type: StepType): Record<string, unknown> => {
    switch (type) {
      case 'NAVIGATE':
        return { url: 'https://' };
      case 'CLICK':
        return { selector: '', text: '' };
      case 'TYPE_TEXT':
        return { selector: '', text: '', humanLike: true };
      case 'WAIT':
        return { duration: 1000, selector: '' };
      case 'SCREENSHOT':
        return { fullPage: true, filename: 'screenshot.png' };
      case 'EXTRACT_DATA':
        return { selector: '', attribute: 'textContent' };
      case 'EXECUTE_SCRIPT':
        return { script: '' };
      case 'FILL_FORM':
        return { formData: {} };
      default:
        return {};
    }
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
    }));
  };

  const updateStepConfig = (stepId: string, configKey: string, value: unknown) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId
        ? { ...s, config: { ...s.config, [configKey]: value } }
        : s
      ),
    }));
  };

  const deleteStep = (stepId: string) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId),
    }));
    if (selectedStep === stepId) {
      setSelectedStep(null);
    }
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setWorkflow(prev => {
      const newSteps = [...prev.steps];
      const [removed] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, removed);
      return { ...prev, steps: newSteps };
    });
  };

  const runWorkflow = async () => {
    if (workflow.steps.length === 0) return;
    
    setRunning(true);
    setRunStatus('running');

    try {
      // Build the command from workflow steps
      const stepDescriptions = workflow.steps.map(step => {
        switch (step.type) {
          case 'NAVIGATE':
            return `go to ${step.config.url}`;
          case 'CLICK':
            return step.config.text ? `click on "${step.config.text}"` : `click ${step.config.selector}`;
          case 'TYPE_TEXT':
            return `type "${step.config.text}" in ${step.config.selector || 'the field'}`;
          case 'WAIT':
            return step.config.selector ? `wait for ${step.config.selector}` : `wait ${step.config.duration}ms`;
          case 'SCREENSHOT':
            return 'take screenshot';
          case 'EXTRACT_DATA':
            return `extract data from ${step.config.selector}`;
          case 'FILL_FORM':
            return 'fill the form with generated data';
          case 'EXECUTE_SCRIPT':
            return 'run custom script';
          default:
            return step.name;
        }
      }).join(', then ');

      const command = `Launch ${workflow.browserCount} browser${workflow.browserCount > 1 ? 's' : ''} and ${stepDescriptions}`;
      
      // Execute workflow via backend
      await window.electron?.invoke('command:execute', command);
      
      setRunStatus('success');
    } catch (error) {
      console.error('Workflow execution failed:', error);
      setRunStatus('error');
    } finally {
      setRunning(false);
      setTimeout(() => setRunStatus('idle'), 3000);
    }
  };

  const duplicateStep = (stepId: string) => {
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;
    
    const newStep: WorkflowStep = {
      ...step,
      id: `step-${Date.now()}`,
      name: `${step.name} (Copy)`,
    };
    
    const index = workflow.steps.findIndex(s => s.id === stepId);
    setWorkflow(prev => {
      const newSteps = [...prev.steps];
      newSteps.splice(index + 1, 0, newStep);
      return { ...prev, steps: newSteps };
    });
  };

  const exportWorkflow = () => {
    const data = JSON.stringify(workflow, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importWorkflow = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as Workflow;
          setWorkflow(data);
        } catch (error) {
          console.error('Failed to import workflow:', error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const getStepTypeInfo = (type: StepType) => STEP_TYPES.find(s => s.type === type);

  return (
    <div className="flex-1 flex h-[calc(100vh-4rem)]">
      {/* Left Panel - Steps List */}
      <div className="w-96 border-r bg-card/50 flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold truncate">{workflow.name}</h2>
            <Button variant="ghost" size="icon" onClick={() => setSettingsDialog(true)}>
              <Settings className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {workflow.description || 'No description'}
          </p>
        </div>

        <div className="p-4 border-b">
          <Button className="w-full" onClick={() => setAddStepDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Step
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {workflow.steps.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <p>No steps yet</p>
                <p className="text-sm">Click "Add Step" to get started</p>
              </div>
            ) : (
              workflow.steps.map((step, index) => {
                const typeInfo = getStepTypeInfo(step.type);
                return (
                  <Card
                    key={step.id}
                    className={cn(
                      'cursor-pointer transition-all hover:shadow-md',
                      selectedStep === step.id && 'ring-2 ring-accent',
                      draggedStep === step.id && 'opacity-50'
                    )}
                    draggable
                    onDragStart={() => setDraggedStep(step.id)}
                    onDragEnd={() => setDraggedStep(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedStep) {
                        const fromIndex = workflow.steps.findIndex(s => s.id === draggedStep);
                        moveStep(fromIndex, index);
                      }
                    }}
                    onClick={() => setSelectedStep(step.id)}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="cursor-grab">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className={cn(
                        'flex h-8 w-8 items-center justify-center rounded text-white',
                        typeInfo?.color || 'bg-gray-500'
                      )}>
                        {typeInfo?.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{step.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {step.type}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {index + 1}
                      </Badge>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={importWorkflow}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={exportWorkflow}
              disabled={workflow.steps.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
          <Button
            className="w-full"
            onClick={runWorkflow}
            disabled={workflow.steps.length === 0 || running}
          >
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : runStatus === 'success' ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                Success!
              </>
            ) : runStatus === 'error' ? (
              <>
                <X className="h-4 w-4 mr-2 text-red-500" />
                Failed
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Workflow ({workflow.browserCount} browser{workflow.browserCount > 1 ? 's' : ''})
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Right Panel - Step Editor */}
      <div className="flex-1 p-6">
        {selectedStepData ? (
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded text-white',
                    getStepTypeInfo(selectedStepData.type)?.color
                  )}>
                    {getStepTypeInfo(selectedStepData.type)?.icon}
                  </div>
                  <div>
                    <CardTitle>{selectedStepData.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {getStepTypeInfo(selectedStepData.type)?.description}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicateStep(selectedStepData.id)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteStep(selectedStepData.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Step Name</Label>
                <Input
                  value={selectedStepData.name}
                  onChange={(e) => updateStep(selectedStepData.id, { name: e.target.value })}
                />
              </div>

              {/* Step-specific config */}
              {selectedStepData.type === 'NAVIGATE' && (
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    placeholder="https://example.com"
                    value={selectedStepData.config.url as string || ''}
                    onChange={(e) => updateStepConfig(selectedStepData.id, 'url', e.target.value)}
                  />
                </div>
              )}

              {selectedStepData.type === 'CLICK' && (
                <>
                  <div className="space-y-2">
                    <Label>CSS Selector (optional)</Label>
                    <Input
                      placeholder="#submit-button, .btn-primary"
                      value={selectedStepData.config.selector as string || ''}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'selector', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Leave empty to use smart detection
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Button Text (optional)</Label>
                    <Input
                      placeholder="Submit, Next, Sign Up"
                      value={selectedStepData.config.text as string || ''}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'text', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Click element containing this text
                    </p>
                  </div>
                </>
              )}

              {selectedStepData.type === 'TYPE_TEXT' && (
                <>
                  <div className="space-y-2">
                    <Label>CSS Selector</Label>
                    <Input
                      placeholder="input[name='email'], #username"
                      value={selectedStepData.config.selector as string || ''}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'selector', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Text to Type</Label>
                    <Textarea
                      placeholder="Enter the text to type..."
                      value={selectedStepData.config.text as string || ''}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'text', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{random_email}'}, {'{random_name}'}, {'{random_phone}'} for dynamic values
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="humanLike"
                      checked={selectedStepData.config.humanLike as boolean ?? true}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'humanLike', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="humanLike" className="text-sm">
                      Type with human-like delays
                    </label>
                  </div>
                </>
              )}

              {selectedStepData.type === 'WAIT' && (
                <>
                  <div className="space-y-2">
                    <Label>Wait Duration (ms)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={selectedStepData.config.duration as number || 1000}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'duration', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Wait for Selector (optional)</Label>
                    <Input
                      placeholder=".loaded, #content"
                      value={selectedStepData.config.selector as string || ''}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'selector', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Wait until this element appears on the page
                    </p>
                  </div>
                </>
              )}

              {selectedStepData.type === 'SCREENSHOT' && (
                <>
                  <div className="space-y-2">
                    <Label>Filename</Label>
                    <Input
                      value={selectedStepData.config.filename as string || 'screenshot.png'}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'filename', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="fullPage"
                      checked={selectedStepData.config.fullPage as boolean ?? true}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'fullPage', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="fullPage" className="text-sm">
                      Capture full page
                    </label>
                  </div>
                </>
              )}

              {selectedStepData.type === 'EXTRACT_DATA' && (
                <>
                  <div className="space-y-2">
                    <Label>CSS Selector</Label>
                    <Input
                      placeholder="h1, .product-title, table"
                      value={selectedStepData.config.selector as string || ''}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'selector', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Attribute to Extract</Label>
                    <Input
                      placeholder="textContent, href, src"
                      value={selectedStepData.config.attribute as string || 'textContent'}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'attribute', e.target.value)}
                    />
                  </div>
                </>
              )}

              {selectedStepData.type === 'EXECUTE_SCRIPT' && (
                <div className="space-y-2">
                  <Label>JavaScript Code</Label>
                  <Textarea
                    placeholder="// Your JavaScript code here..."
                    value={selectedStepData.config.script as string || ''}
                    onChange={(e) => updateStepConfig(selectedStepData.id, 'script', e.target.value)}
                    className="font-mono min-h-[200px]"
                  />
                </div>
              )}

              {selectedStepData.type === 'FILL_FORM' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    This step will automatically detect form fields and fill them with generated data.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="autoSubmit"
                      checked={selectedStepData.config.autoSubmit as boolean ?? false}
                      onChange={(e) => updateStepConfig(selectedStepData.id, 'autoSubmit', e.target.checked)}
                      className="w-4 h-4"
                    />
                    <label htmlFor="autoSubmit" className="text-sm">
                      Automatically submit after filling
                    </label>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <ChevronRight className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium">Select a step to edit</h3>
              <p className="text-sm">or add a new step from the left panel</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Step Dialog */}
      <Dialog open={addStepDialog} onOpenChange={setAddStepDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Step</DialogTitle>
            <DialogDescription>
              Choose an action type for your workflow step
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {STEP_TYPES.map((stepType) => (
              <Card
                key={stepType.type}
                className="cursor-pointer hover:shadow-md hover:ring-2 hover:ring-accent transition-all"
                onClick={() => addStep(stepType.type)}
              >
                <CardContent className="p-4 flex items-start gap-3">
                  <div className={cn(
                    'flex h-10 w-10 items-center justify-center rounded text-white shrink-0',
                    stepType.color
                  )}>
                    {stepType.icon}
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{stepType.name}</h4>
                    <p className="text-xs text-muted-foreground">{stepType.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Workflow Settings Dialog */}
      <Dialog open={settingsDialog} onOpenChange={setSettingsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workflow Settings</DialogTitle>
            <DialogDescription>
              Configure your workflow properties
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Workflow Name</Label>
              <Input
                value={workflow.name}
                onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this workflow does..."
                value={workflow.description}
                onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Number of Browsers</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={workflow.browserCount}
                onChange={(e) => setWorkflow({ ...workflow, browserCount: parseInt(e.target.value) || 1 })}
              />
              <p className="text-xs text-muted-foreground">
                How many browsers to launch for parallel execution
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setSettingsDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
