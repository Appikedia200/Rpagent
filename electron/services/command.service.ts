/**
 * @fileoverview Command Service
 * @module electron/services/command
 *
 * Interprets and executes user commands from the Command Center.
 * Uses direct task parsing (NOT AI) for command interpretation.
 */

import { BrowserWindow } from 'electron';
import { CommandParser } from '../../automation/workflow-parser';
import { WorkflowService } from './workflow.service';
import { WorkspaceService } from './workspace.service';
import { TaskService } from './task.service';
import { BrowserService } from './browser.service';
import { CommandHistoryRepository, CommandHistoryEntry } from '../database/repositories/command-history.repository';
import { 
  CommandInput, 
  CommandResult,
  CommandResultType,
} from '../../shared/types/command.types';
import { logger } from '../utils/logger';

/**
 * Command service error
 */
export class CommandServiceError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'CommandServiceError';
  }
}

/**
 * Command execution service
 */
export class CommandService {
  private parser: CommandParser;
  private workflowService: WorkflowService;
  private workspaceService: WorkspaceService;
  private taskService: TaskService;
  private browserService: BrowserService;
  private historyRepo: CommandHistoryRepository;

  constructor() {
    this.parser = new CommandParser();
    this.workflowService = new WorkflowService();
    this.workspaceService = new WorkspaceService();
    this.taskService = new TaskService();
    this.browserService = new BrowserService();
    this.historyRepo = new CommandHistoryRepository();
  }

  /**
   * Set main window for IPC communication
   */
  setMainWindow(window: BrowserWindow): void {
    this.taskService.setMainWindow(window);
  }

  /**
   * Execute a user command
   */
  async execute(input: CommandInput): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      logger.info('Executing command', { 
        length: input.raw.length,
        preview: input.raw.substring(0, 100),
      });

      // Parse command
      const parsed = this.parser.parse(input.raw);
      
      logger.info('Command parsed result', {
        browsers: parsed.browsers,
        stepCount: parsed.steps.length,
        steps: parsed.steps.map(s => ({ type: s.type, desc: s.description, config: s.config })),
      });

      if (parsed.steps.length === 0 && parsed.browsers === 0) {
        // No actionable steps AND no browsers requested
        return {
          type: CommandResultType.INFO,
          message: 'I understand you want to automate something, but I need more specific instructions. Try commands like:\n\n• "Launch a browser"\n• "Create 5 browsers, navigate to google.com"\n• "Click the login button"\n• "Type username in email field"',
          suggestions: this.parser.getSuggestions(input.raw),
          timestamp: new Date().toISOString(),
        };
      }

      // STEP 1: SMART BROWSER HANDLING
      // Priority: Use existing idle workspaces with proxies, then create new ones if needed
      let workspaceIds: string[] = [];
      
      if (parsed.browsers > 0) {
        // First, check for existing IDLE workspaces that already have proxies
        const allWorkspaces = await this.workspaceService.getAll();
        const idleWorkspacesWithProxy = allWorkspaces.filter(
          (w: any) => w.proxyId && (w.status === 'idle' || w.status === 'error')
        );
        
        logger.info('Existing workspaces check', {
          total: allWorkspaces.length,
          idleWithProxy: idleWorkspacesWithProxy.length,
          requested: parsed.browsers,
        });
        
        // Use existing idle workspaces first (for "launch a browser" type commands)
        if (idleWorkspacesWithProxy.length > 0 && parsed.browsers <= idleWorkspacesWithProxy.length) {
          // Use existing workspaces - no need to create new ones
          workspaceIds = idleWorkspacesWithProxy.slice(0, parsed.browsers).map((w: any) => w.id);
          
          logger.info('Using existing workspaces with proxies', {
            workspaceIds,
            workspaces: workspaceIds.map(id => {
              const ws = idleWorkspacesWithProxy.find((w: any) => w.id === id);
              return { id, proxyId: ws?.proxyId };
            }),
          });
        } else {
          // Need to create new workspaces - check available proxies
          const availableProxies = await this.workspaceService.getAvailableProxies();
          const neededNew = parsed.browsers - idleWorkspacesWithProxy.length;
          
          logger.info('Proxy availability check', {
            requestedBrowsers: parsed.browsers,
            existingIdle: idleWorkspacesWithProxy.length,
            needNew: neededNew,
            availableProxies: availableProxies.length,
          });
          
          // CHECK: Do we have enough resources?
          if (idleWorkspacesWithProxy.length === 0 && availableProxies.length === 0) {
            return {
              type: CommandResultType.ERROR,
              message: '❌ No proxies available!\n\nPlease add proxies in the Proxies page before launching browsers.\nEvery browser requires a dedicated proxy IP.',
              timestamp: new Date().toISOString(),
            };
          }
          
          if (neededNew > 0 && availableProxies.length < neededNew) {
            const totalAvailable = idleWorkspacesWithProxy.length + availableProxies.length;
            return {
              type: CommandResultType.ERROR,
              message: `❌ Not enough proxies!\n\nYou requested ${parsed.browsers} browser(s) but only ${totalAvailable} available (${idleWorkspacesWithProxy.length} existing + ${availableProxies.length} new proxies).\n\nOptions:\n• Request only ${totalAvailable} browser(s)\n• Add ${parsed.browsers - totalAvailable} more proxies\n• Delete existing browsers to free up proxies`,
              timestamp: new Date().toISOString(),
            };
          }
          
          // Use existing idle workspaces first
          workspaceIds = idleWorkspacesWithProxy.map((w: any) => w.id);
          
          // Create new workspaces for remaining
          if (neededNew > 0 && availableProxies.length >= neededNew) {
            if (neededNew > 1) {
              const newWorkspaces = await this.workspaceService.createBulkWithProxies(
                neededNew,
                availableProxies.slice(0, neededNew),
                'WS'
              );
              workspaceIds.push(...newWorkspaces.map(w => w.id));
            } else {
              const newWorkspace = await this.workspaceService.createWithProxy(
                `Workspace ${Date.now()}`,
                availableProxies[0]
              );
              workspaceIds.push(newWorkspace.id);
            }
          }

          logger.info('Workspaces prepared for launch', { 
            count: workspaceIds.length,
            workspaceIds,
          });
        }
      }

      // Launch browsers
      if (workspaceIds.length > 0) {
        const launchResult = await this.browserService.launchMultiple(workspaceIds);

        if (launchResult.launched === 0) {
          // Show actual error message to help debugging
          const errorDetail = launchResult.errors && launchResult.errors.length > 0
            ? `\n\nError: ${launchResult.errors[0]}`
            : '';
          return {
            type: CommandResultType.ERROR,
            message: `Failed to launch any browsers.${errorDetail}`,
            timestamp: new Date().toISOString(),
          };
        }

        if (launchResult.failed > 0) {
          logger.warn('Some browsers failed to launch', {
            launched: launchResult.launched,
            failed: launchResult.failed,
          });
        }
      }

      // Handle simple commands without steps
      if (parsed.steps.length === 0) {
        return {
          type: CommandResultType.SUCCESS,
          message: `Created ${workspaceIds.length} browser${workspaceIds.length > 1 ? 's' : ''}. Ready for commands.`,
          data: {
            workspacesCreated: workspaceIds.length,
            browsersLaunched: workspaceIds.length,
          },
          workspaceIds,
          timestamp: new Date().toISOString(),
        };
      }

      // Create workflow from parsed steps
      const workflow = await this.workflowService.create({
        name: `Command - ${new Date().toISOString()}`,
        description: input.raw.substring(0, 500),
        browsers: parsed.browsers,
        steps: parsed.steps,
        dataSource: parsed.dataSource,
      });

      // Create and execute task
      const task = await this.taskService.create({
        name: workflow.name,
        workflowId: workflow.id,
        workspaceIds,
      });

      logger.info('Task starting with steps', {
        taskId: task.id,
        stepDetails: parsed.steps.map(s => ({ type: s.type, desc: s.description })),
      });

      // Execute task (browsers are already launched from launchMultiple above)
      this.taskService.execute(task.id).catch(error => {
        logger.error('Task execution failed', { 
          error: error instanceof Error ? error.message : error, 
          stack: error instanceof Error ? error.stack : undefined,
          taskId: task.id 
        });
      });

      const duration = Date.now() - startTime;

      logger.info('Command execution started', {
        taskId: task.id,
        workflowId: workflow.id,
        browsers: workspaceIds.length,
        steps: parsed.steps.length,
        duration,
      });

      const result: CommandResult = {
        type: CommandResultType.SUCCESS,
        message: `Executing ${parsed.steps.length} step${parsed.steps.length > 1 ? 's' : ''} across ${workspaceIds.length} browser${workspaceIds.length > 1 ? 's' : ''}...`,
        data: {
          workspacesCreated: workspaceIds.length,
          browsersLaunched: workspaceIds.length,
          workflowId: workflow.id,
          taskId: task.id,
          steps: parsed.steps.map(s => s.description || s.type),
        },
        taskId: task.id,
        workspaceIds,
        timestamp: new Date().toISOString(),
      };

      // Save to history
      this.historyRepo.save(input.raw, result);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Command execution failed', { error, duration });

      const result: CommandResult = {
        type: CommandResultType.ERROR,
        message: `Failed to execute command: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };

      // Save error to history too
      this.historyRepo.save(input.raw, result);

      return result;
    }
  }

  /**
   * Get command suggestions
   */
  getSuggestions(partialCommand: string): string[] {
    return this.parser.getSuggestions(partialCommand);
  }

  /**
   * Get command history
   */
  getHistory(limit: number = 100): CommandHistoryEntry[] {
    return this.historyRepo.findAll(limit);
  }

  /**
   * Clear command history
   */
  clearHistory(): number {
    return this.historyRepo.clearAll();
  }
}
