/**
 * @fileoverview Enterprise Variable System
 * @module automation/variables/variable-store
 * 
 * Professional-grade variable management with scoping, persistence,
 * type coercion, and expression interpolation.
 */

export type VariableScope = 'global' | 'workflow' | 'task' | 'browser' | 'step';
export type VariableType = 'string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'any';

export interface Variable {
  name: string;
  value: unknown;
  type: VariableType;
  scope: VariableScope;
  readonly?: boolean;
  encrypted?: boolean;
  description?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface VariableDefinition {
  name: string;
  type?: VariableType;
  defaultValue?: unknown;
  scope?: VariableScope;
  readonly?: boolean;
  encrypted?: boolean;
  description?: string;
  expiresIn?: number;      // ms until expiration
}

export interface VariableStoreConfig {
  enablePersistence?: boolean;
  persistencePath?: string;
  encryptionKey?: string;
}

export class VariableStore {
  private variables: Map<string, Variable> = new Map();
  private scopes: Map<VariableScope, Map<string, Variable>> = new Map();
  private history: Array<{ action: string; name: string; oldValue?: unknown; newValue?: unknown; timestamp: number }> = [];
  private maxHistorySize = 1000;
  private watchers: Map<string, Array<(value: unknown, oldValue: unknown) => void>> = new Map();

  constructor(private config: VariableStoreConfig = {}) {
    // Initialize scope maps
    this.scopes.set('global', new Map());
    this.scopes.set('workflow', new Map());
    this.scopes.set('task', new Map());
    this.scopes.set('browser', new Map());
    this.scopes.set('step', new Map());
  }

  /**
   * Set a variable
   */
  set(name: string, value: unknown, options: Partial<VariableDefinition> = {}): void {
    const scope = options.scope || 'workflow';
    const existingVariable = this.getVariable(name);
    
    if (existingVariable?.readonly) {
      throw new Error(`Variable "${name}" is readonly`);
    }

    const now = Date.now();
    const variable: Variable = {
      name,
      value: this.coerceType(value, options.type || 'any'),
      type: options.type || this.inferType(value),
      scope,
      readonly: options.readonly || false,
      encrypted: options.encrypted || false,
      description: options.description,
      createdAt: existingVariable?.createdAt || now,
      updatedAt: now,
      expiresAt: options.expiresIn ? now + options.expiresIn : undefined,
    };

    const oldValue = existingVariable?.value;
    
    this.variables.set(name, variable);
    this.scopes.get(scope)?.set(name, variable);
    
    this.recordHistory('set', name, oldValue, value);
    this.notifyWatchers(name, value, oldValue);
  }

  /**
   * Get a variable value
   */
  get<T = unknown>(name: string): T | undefined {
    const variable = this.variables.get(name);
    
    if (!variable) return undefined;
    
    // Check expiration
    if (variable.expiresAt && Date.now() > variable.expiresAt) {
      this.delete(name);
      return undefined;
    }
    
    return variable.value as T;
  }

  /**
   * Get full variable object
   */
  getVariable(name: string): Variable | undefined {
    return this.variables.get(name);
  }

  /**
   * Get all variables
   */
  getAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [name, variable] of this.variables) {
      if (!variable.expiresAt || Date.now() <= variable.expiresAt) {
        result[name] = variable.value;
      }
    }
    return result;
  }

  /**
   * Get variables by scope
   */
  getByScope(scope: VariableScope): Record<string, unknown> {
    const scopeVars = this.scopes.get(scope);
    if (!scopeVars) return {};
    
    const result: Record<string, unknown> = {};
    for (const [name, variable] of scopeVars) {
      if (!variable.expiresAt || Date.now() <= variable.expiresAt) {
        result[name] = variable.value;
      }
    }
    return result;
  }

  /**
   * Check if variable exists
   */
  has(name: string): boolean {
    const variable = this.variables.get(name);
    if (!variable) return false;
    if (variable.expiresAt && Date.now() > variable.expiresAt) {
      this.delete(name);
      return false;
    }
    return true;
  }

  /**
   * Delete a variable
   */
  delete(name: string): boolean {
    const variable = this.variables.get(name);
    if (!variable) return false;
    
    if (variable.readonly) {
      throw new Error(`Variable "${name}" is readonly`);
    }
    
    this.variables.delete(name);
    this.scopes.get(variable.scope)?.delete(name);
    this.recordHistory('delete', name, variable.value, undefined);
    
    return true;
  }

  /**
   * Clear variables by scope
   */
  clearScope(scope: VariableScope): number {
    const scopeVars = this.scopes.get(scope);
    if (!scopeVars) return 0;
    
    const count = scopeVars.size;
    
    for (const [name, variable] of scopeVars) {
      if (!variable.readonly) {
        this.variables.delete(name);
      }
    }
    
    scopeVars.clear();
    return count;
  }

  /**
   * Clear all variables
   */
  clearAll(): void {
    for (const [name, variable] of this.variables) {
      if (!variable.readonly) {
        this.variables.delete(name);
      }
    }
    
    for (const scope of this.scopes.values()) {
      scope.clear();
    }
    
    this.recordHistory('clear_all', '*', undefined, undefined);
  }

  /**
   * Interpolate variables in a string
   * Supports: ${varName}, {{varName}}, ${varName.property}
   */
  interpolate(template: string): string {
    return template.replace(/\$\{([^}]+)\}|\{\{([^}]+)\}\}/g, (match, v1, v2) => {
      const varPath = (v1 || v2).trim();
      const value = this.resolvePath(varPath);
      return value !== undefined ? String(value) : match;
    });
  }

  /**
   * Resolve a variable path (e.g., "user.name" or "items[0].id")
   */
  resolvePath(path: string): unknown {
    const parts = path.split(/[.\[\]]+/).filter(Boolean);
    if (parts.length === 0) return undefined;
    
    let current: unknown = this.get(parts[0]);
    
    for (let i = 1; i < parts.length; i++) {
      if (current === null || current === undefined) return undefined;
      if (typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[parts[i]];
    }
    
    return current;
  }

  /**
   * Set multiple variables at once
   */
  setMany(variables: Record<string, unknown>, options: Partial<VariableDefinition> = {}): void {
    for (const [name, value] of Object.entries(variables)) {
      this.set(name, value, options);
    }
  }

  /**
   * Merge into an object variable
   */
  merge(name: string, value: Record<string, unknown>): void {
    const existing = this.get<Record<string, unknown>>(name) || {};
    if (typeof existing !== 'object' || Array.isArray(existing)) {
      throw new Error(`Cannot merge into non-object variable "${name}"`);
    }
    this.set(name, { ...existing, ...value });
  }

  /**
   * Push to an array variable
   */
  push(name: string, value: unknown): void {
    const existing = this.get<unknown[]>(name) || [];
    if (!Array.isArray(existing)) {
      throw new Error(`Cannot push to non-array variable "${name}"`);
    }
    this.set(name, [...existing, value]);
  }

  /**
   * Increment a numeric variable
   */
  increment(name: string, amount: number = 1): number {
    const existing = this.get<number>(name) || 0;
    if (typeof existing !== 'number') {
      throw new Error(`Cannot increment non-numeric variable "${name}"`);
    }
    const newValue = existing + amount;
    this.set(name, newValue);
    return newValue;
  }

  /**
   * Decrement a numeric variable
   */
  decrement(name: string, amount: number = 1): number {
    return this.increment(name, -amount);
  }

  /**
   * Watch a variable for changes
   */
  watch(name: string, callback: (value: unknown, oldValue: unknown) => void): () => void {
    if (!this.watchers.has(name)) {
      this.watchers.set(name, []);
    }
    this.watchers.get(name)!.push(callback);
    
    // Return unwatch function
    return () => {
      const watchers = this.watchers.get(name);
      if (watchers) {
        const index = watchers.indexOf(callback);
        if (index !== -1) {
          watchers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify watchers of a change
   */
  private notifyWatchers(name: string, value: unknown, oldValue: unknown): void {
    const watchers = this.watchers.get(name);
    if (watchers) {
      for (const callback of watchers) {
        try {
          callback(value, oldValue);
        } catch (error) {
          console.error(`[VariableStore] Watcher error for "${name}":`, error);
        }
      }
    }
  }

  /**
   * Record history
   */
  private recordHistory(action: string, name: string, oldValue?: unknown, newValue?: unknown): void {
    this.history.unshift({
      action,
      name,
      oldValue,
      newValue,
      timestamp: Date.now(),
    });
    
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Get history
   */
  getHistory(limit?: number): typeof this.history {
    return limit ? this.history.slice(0, limit) : this.history;
  }

  /**
   * Infer type from value
   */
  private inferType(value: unknown): VariableType {
    if (value === null || value === undefined) return 'any';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (value instanceof Date) return 'date';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'any';
  }

  /**
   * Coerce value to type
   */
  private coerceType(value: unknown, type: VariableType): unknown {
    if (type === 'any' || value === null || value === undefined) {
      return value;
    }

    switch (type) {
      case 'string':
        return String(value);
      case 'number':
        return Number(value);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return value instanceof Date ? value : new Date(String(value));
      case 'array':
        return Array.isArray(value) ? value : [value];
      case 'object':
        return typeof value === 'object' ? value : { value };
      default:
        return value;
    }
  }

  /**
   * Export to JSON
   */
  toJSON(): string {
    const data: Record<string, Variable> = {};
    for (const [name, variable] of this.variables) {
      data[name] = variable;
    }
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import from JSON
   */
  fromJSON(json: string): void {
    const data = JSON.parse(json) as Record<string, Variable>;
    for (const [name, variable] of Object.entries(data)) {
      this.set(name, variable.value, {
        type: variable.type,
        scope: variable.scope,
        readonly: variable.readonly,
        encrypted: variable.encrypted,
        description: variable.description,
      });
    }
  }

  /**
   * Create a child store (inherits parent variables)
   */
  createChild(scope: VariableScope): VariableStore {
    const child = new VariableStore(this.config);
    
    // Copy parent variables
    for (const [name, variable] of this.variables) {
      if (variable.scope === 'global' || variable.scope === scope) {
        child.set(name, variable.value, {
          type: variable.type,
          scope: variable.scope,
          readonly: variable.readonly,
          description: variable.description,
        });
      }
    }
    
    return child;
  }
}

// Singleton instance
let storeInstance: VariableStore | null = null;

export function getVariableStore(config?: VariableStoreConfig): VariableStore {
  if (!storeInstance) {
    storeInstance = new VariableStore(config);
  }
  return storeInstance;
}

export function destroyVariableStore(): void {
  if (storeInstance) {
    storeInstance.clearAll();
    storeInstance = null;
  }
}

/**
 * Built-in system variables
 */
export function initializeSystemVariables(store: VariableStore): void {
  store.set('_timestamp', Date.now(), { scope: 'global', readonly: false });
  store.set('_date', new Date().toISOString().split('T')[0], { scope: 'global', readonly: false });
  store.set('_time', new Date().toISOString().split('T')[1].split('.')[0], { scope: 'global', readonly: false });
  store.set('_random', Math.random(), { scope: 'global', readonly: false });
  store.set('_uuid', crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, { scope: 'global', readonly: false });
}

