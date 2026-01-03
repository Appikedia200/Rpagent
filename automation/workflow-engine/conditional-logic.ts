/**
 * @fileoverview Conditional Logic Engine
 * @module automation/workflow-engine/conditional-logic
 * 
 * Provides if/else, switch, loops, and conditional branching
 * for workflows with expression evaluation.
 */

import { Page } from 'playwright';

export type ConditionOperator = 
  | 'equals' | 'notEquals' 
  | 'contains' | 'notContains'
  | 'startsWith' | 'endsWith'
  | 'greaterThan' | 'lessThan' | 'greaterOrEqual' | 'lessOrEqual'
  | 'isEmpty' | 'isNotEmpty'
  | 'matches' | 'exists' | 'notExists'
  | 'isTrue' | 'isFalse';

export interface Condition {
  type: 'simple' | 'compound' | 'expression';
  // Simple condition
  left?: string;           // Variable name or value
  operator?: ConditionOperator;
  right?: string;          // Compare value
  // Compound condition
  logic?: 'and' | 'or';
  conditions?: Condition[];
  // Expression (JavaScript-like)
  expression?: string;
}

export interface ConditionalStep {
  id: string;
  type: 'if' | 'else-if' | 'else' | 'switch' | 'while' | 'for' | 'forEach';
  condition?: Condition;
  // For switch
  switchValue?: string;
  cases?: Array<{ value: string; steps: WorkflowStep[] }>;
  defaultCase?: WorkflowStep[];
  // For loops
  loopVariable?: string;
  loopStart?: number;
  loopEnd?: number;
  loopStep?: number;
  loopItems?: string;      // Variable containing array
  maxIterations?: number;  // Safety limit
  // Steps to execute
  thenSteps?: WorkflowStep[];
  elseSteps?: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface EvaluationContext {
  variables: Record<string, unknown>;
  page?: Page;
  results: Record<string, unknown>;
}

export class ConditionalLogicEngine {
  private context: EvaluationContext;

  constructor(initialContext: Partial<EvaluationContext> = {}) {
    this.context = {
      variables: initialContext.variables || {},
      page: initialContext.page,
      results: initialContext.results || {},
    };
  }

  /**
   * Update context
   */
  updateContext(updates: Partial<EvaluationContext>): void {
    if (updates.variables) {
      this.context.variables = { ...this.context.variables, ...updates.variables };
    }
    if (updates.page) {
      this.context.page = updates.page;
    }
    if (updates.results) {
      this.context.results = { ...this.context.results, ...updates.results };
    }
  }

  /**
   * Set a variable
   */
  setVariable(name: string, value: unknown): void {
    this.context.variables[name] = value;
  }

  /**
   * Get a variable
   */
  getVariable(name: string): unknown {
    return this.context.variables[name];
  }

  /**
   * Get all variables
   */
  getVariables(): Record<string, unknown> {
    return { ...this.context.variables };
  }

  /**
   * Evaluate a condition
   */
  async evaluateCondition(condition: Condition): Promise<boolean> {
    switch (condition.type) {
      case 'simple':
        return this.evaluateSimpleCondition(condition);
      case 'compound':
        return this.evaluateCompoundCondition(condition);
      case 'expression':
        return this.evaluateExpression(condition.expression || 'false');
      default:
        return false;
    }
  }

  /**
   * Evaluate a simple condition
   */
  private evaluateSimpleCondition(condition: Condition): boolean {
    const left = this.resolveValue(condition.left || '');
    const right = this.resolveValue(condition.right || '');
    const operator = condition.operator || 'equals';

    switch (operator) {
      case 'equals':
        return left === right;
      case 'notEquals':
        return left !== right;
      case 'contains':
        return String(left).includes(String(right));
      case 'notContains':
        return !String(left).includes(String(right));
      case 'startsWith':
        return String(left).startsWith(String(right));
      case 'endsWith':
        return String(left).endsWith(String(right));
      case 'greaterThan':
        return Number(left) > Number(right);
      case 'lessThan':
        return Number(left) < Number(right);
      case 'greaterOrEqual':
        return Number(left) >= Number(right);
      case 'lessOrEqual':
        return Number(left) <= Number(right);
      case 'isEmpty':
        return left === '' || left === null || left === undefined || 
               (Array.isArray(left) && left.length === 0);
      case 'isNotEmpty':
        return left !== '' && left !== null && left !== undefined && 
               !(Array.isArray(left) && left.length === 0);
      case 'matches':
        try {
          return new RegExp(String(right)).test(String(left));
        } catch {
          return false;
        }
      case 'exists':
        return left !== null && left !== undefined;
      case 'notExists':
        return left === null || left === undefined;
      case 'isTrue':
        return left === true || left === 'true' || left === 1;
      case 'isFalse':
        return left === false || left === 'false' || left === 0;
      default:
        return false;
    }
  }

  /**
   * Evaluate a compound condition (AND/OR)
   */
  private async evaluateCompoundCondition(condition: Condition): Promise<boolean> {
    if (!condition.conditions || condition.conditions.length === 0) {
      return true;
    }

    const results = await Promise.all(
      condition.conditions.map(c => this.evaluateCondition(c))
    );

    if (condition.logic === 'and') {
      return results.every(r => r);
    } else {
      return results.some(r => r);
    }
  }

  /**
   * Evaluate a JavaScript-like expression
   */
  private evaluateExpression(expression: string): boolean {
    try {
      // Create a safe evaluation context
      const contextVars = { ...this.context.variables, ...this.context.results };
      
      // Build variable declarations
      const varDeclarations = Object.entries(contextVars)
        .map(([key, value]) => `const ${key} = ${JSON.stringify(value)};`)
        .join('\n');
      
      // Evaluate the expression
      const code = `${varDeclarations}\n(${expression})`;
      const result = new Function(code)();
      
      return Boolean(result);
    } catch (error) {
      console.error('[ConditionalLogic] Expression evaluation error:', error);
      return false;
    }
  }

  /**
   * Resolve a value (variable reference or literal)
   */
  resolveValue(value: string): unknown {
    if (typeof value !== 'string') return value;
    
    // Check if it's a variable reference (${varName} or {{varName}})
    const varMatch = value.match(/^\$\{(.+)\}$/) || value.match(/^\{\{(.+)\}\}$/);
    if (varMatch) {
      const varName = varMatch[1].trim();
      return this.getNestedValue(varName);
    }
    
    // Check if entire string is a variable name
    if (value in this.context.variables) {
      return this.context.variables[value];
    }
    
    // Interpolate variables in string
    return value.replace(/\$\{([^}]+)\}|\{\{([^}]+)\}\}/g, (_, v1, v2) => {
      const varName = (v1 || v2).trim();
      const resolved = this.getNestedValue(varName);
      return resolved !== undefined ? String(resolved) : '';
    });
  }

  /**
   * Get nested value (e.g., "user.name" or "results.step1.data")
   */
  private getNestedValue(path: string): unknown {
    const parts = path.split('.');
    let current: unknown = { ...this.context.variables, ...this.context.results };
    
    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    
    return current;
  }

  /**
   * Execute a conditional step and return the steps to run
   */
  async executeConditional(step: ConditionalStep): Promise<WorkflowStep[]> {
    switch (step.type) {
      case 'if':
        return this.executeIf(step);
      case 'switch':
        return this.executeSwitch(step);
      case 'while':
        return this.executeWhile(step);
      case 'for':
        return this.executeFor(step);
      case 'forEach':
        return this.executeForEach(step);
      default:
        return [];
    }
  }

  /**
   * Execute if/else-if/else
   */
  private async executeIf(step: ConditionalStep): Promise<WorkflowStep[]> {
    if (step.condition && await this.evaluateCondition(step.condition)) {
      return step.thenSteps || [];
    }
    return step.elseSteps || [];
  }

  /**
   * Execute switch statement
   */
  private async executeSwitch(step: ConditionalStep): Promise<WorkflowStep[]> {
    const value = this.resolveValue(step.switchValue || '');
    
    for (const caseItem of step.cases || []) {
      if (String(value) === String(caseItem.value)) {
        return caseItem.steps;
      }
    }
    
    return step.defaultCase || [];
  }

  /**
   * Execute while loop (returns accumulated steps)
   */
  private async executeWhile(step: ConditionalStep): Promise<WorkflowStep[]> {
    const allSteps: WorkflowStep[] = [];
    let iterations = 0;
    const maxIter = step.maxIterations || 100;
    
    while (iterations < maxIter) {
      if (step.condition && !await this.evaluateCondition(step.condition)) {
        break;
      }
      
      this.setVariable('_loopIndex', iterations);
      allSteps.push(...(step.thenSteps || []));
      iterations++;
    }
    
    return allSteps;
  }

  /**
   * Execute for loop
   */
  private async executeFor(step: ConditionalStep): Promise<WorkflowStep[]> {
    const allSteps: WorkflowStep[] = [];
    const start = step.loopStart || 0;
    const end = step.loopEnd || 10;
    const increment = step.loopStep || 1;
    const varName = step.loopVariable || 'i';
    const maxIter = step.maxIterations || 1000;
    
    let iterations = 0;
    for (let i = start; i < end && iterations < maxIter; i += increment) {
      this.setVariable(varName, i);
      this.setVariable('_loopIndex', iterations);
      allSteps.push(...(step.thenSteps || []));
      iterations++;
    }
    
    return allSteps;
  }

  /**
   * Execute forEach loop
   */
  private async executeForEach(step: ConditionalStep): Promise<WorkflowStep[]> {
    const allSteps: WorkflowStep[] = [];
    const items = this.resolveValue(step.loopItems || '[]');
    const varName = step.loopVariable || 'item';
    const maxIter = step.maxIterations || 1000;
    
    if (!Array.isArray(items)) {
      console.warn('[ConditionalLogic] forEach: items is not an array');
      return [];
    }
    
    for (let i = 0; i < items.length && i < maxIter; i++) {
      this.setVariable(varName, items[i]);
      this.setVariable('_loopIndex', i);
      allSteps.push(...(step.thenSteps || []));
    }
    
    return allSteps;
  }
}

// Singleton instance
let logicEngineInstance: ConditionalLogicEngine | null = null;

export function getConditionalLogicEngine(context?: Partial<EvaluationContext>): ConditionalLogicEngine {
  if (!logicEngineInstance) {
    logicEngineInstance = new ConditionalLogicEngine(context);
  } else if (context) {
    logicEngineInstance.updateContext(context);
  }
  return logicEngineInstance;
}

