'use client';

import * as React from 'react';
import {
  GitBranch,
  Plus,
  Play,
  MoreVertical,
  RefreshCw,
  Search,
  Loader2,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useWorkflows } from '@/hooks/use-workflows';
import { isElectron } from '@/lib/ipc-client';

export default function WorkflowsPage() {
  const { workflows, loading, error, loadWorkflows, createWorkflow, deleteWorkflow, runWorkflow } = useWorkflows();
  const [search, setSearch] = React.useState('');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newWorkflowName, setNewWorkflowName] = React.useState('');
  const [newWorkflowDesc, setNewWorkflowDesc] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  const filteredWorkflows = workflows.filter((wf) =>
    wf.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newWorkflowName.trim()) return;
    setCreating(true);
    try {
      await createWorkflow({
        name: newWorkflowName,
        description: newWorkflowDesc,
        browsers: 1,
        steps: [],
      });
      setCreateDialogOpen(false);
      setNewWorkflowName('');
      setNewWorkflowDesc('');
    } finally {
      setCreating(false);
    }
  };

  const handleRun = async (workflowId: string) => {
    setActionLoading(workflowId);
    await runWorkflow(workflowId);
    setActionLoading(null);
  };

  const handleDelete = async (workflowId: string) => {
    setActionLoading(workflowId);
    await deleteWorkflow(workflowId);
    setActionLoading(null);
  };

  // Total steps across all workflows
  const totalSteps = workflows.reduce((sum, wf) => sum + (wf.steps?.length || 0), 0);

  // Show warning if not in Electron
  if (!isElectron()) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
            <p className="text-muted-foreground">
              Create and manage automation workflows
            </p>
          </div>
        </div>
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-6 w-6 text-yellow-500" />
              <div>
                <h3 className="font-medium">Electron Required</h3>
                <p className="text-sm text-muted-foreground">
                  Workflows require the Electron desktop application. Please run the app via `npm run dev` and access it through the Electron window.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
          <p className="text-muted-foreground">
            Create and manage automation workflows
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Workflow</DialogTitle>
              <DialogDescription>
                Create a new automation workflow
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Workflow Name</Label>
                <Input
                  id="name"
                  placeholder="My Workflow"
                  value={newWorkflowName}
                  onChange={(e) => setNewWorkflowName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  placeholder="Describe what this workflow does..."
                  value={newWorkflowDesc}
                  onChange={(e) => setNewWorkflowDesc(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newWorkflowName.trim()}>
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Workflow
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Row */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Steps</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSteps}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Steps/Workflow</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length > 0 ? (totalSteps / workflows.length).toFixed(1) : '0'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Updated Today</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflows.filter(wf => {
                if (!wf.updatedAt) return false;
                const today = new Date();
                const updated = new Date(wf.updatedAt);
                return updated.toDateString() === today.toDateString();
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All Workflows</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Button variant="outline" size="icon" onClick={loadWorkflows} disabled={loading}>
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            {loading && workflows.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredWorkflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No workflows found</h3>
                <p className="text-sm text-muted-foreground">
                  {workflows.length === 0 
                    ? 'Create your first workflow to get started' 
                    : 'Try a different search term'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredWorkflows.map((workflow) => (
                  <Card key={workflow.id} className="relative">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-lg',
                            'bg-gradient-to-br from-primary/20 to-primary/5'
                          )}>
                            <GitBranch className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{workflow.name}</p>
                              <Badge variant="secondary">{workflow.steps?.length || 0} steps</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {workflow.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                              <span>{workflow.steps?.length || 0} steps</span>
                              <span>{workflow.browsers || 1} browser(s)</span>
                              <span>Updated: {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {actionLoading === workflow.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Button size="sm" onClick={() => handleRun(workflow.id)}>
                                <Play className="h-4 w-4 mr-2" />
                                Run
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>Edit</DropdownMenuItem>
                                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDelete(workflow.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
