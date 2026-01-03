/**
 * @fileoverview Enterprise Data Extraction System
 * @module automation/extraction/data-extractor
 * 
 * Professional-grade web scraping with intelligent element detection,
 * multiple extraction strategies, and structured data output.
 */

import { Page, ElementHandle } from 'playwright';

export type ExtractionType = 
  | 'text' | 'html' | 'attribute' | 'value' | 'href' | 'src'
  | 'table' | 'list' | 'json' | 'screenshot' | 'pdf'
  | 'form' | 'links' | 'images' | 'metadata';

export interface ExtractionRule {
  id: string;
  name: string;
  type: ExtractionType;
  selector?: string;            // CSS selector
  xpath?: string;               // XPath selector
  attribute?: string;           // For attribute extraction
  regex?: string;               // Post-processing regex
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number' | 'date' | 'json';
  multiple?: boolean;           // Extract all matching elements
  optional?: boolean;           // Don't fail if not found
  children?: ExtractionRule[];  // Nested extraction
  fallbackSelector?: string;    // Try if main selector fails
}

export interface ExtractionSchema {
  id: string;
  name: string;
  description?: string;
  url?: string;                 // URL pattern to match
  rules: ExtractionRule[];
  pagination?: {
    nextSelector?: string;
    maxPages?: number;
    waitBetweenPages?: number;
  };
  output?: {
    format: 'json' | 'csv' | 'excel' | 'xml';
    filename?: string;
  };
}

export interface ExtractionResult {
  schemaId: string;
  url: string;
  timestamp: string;
  data: Record<string, unknown>;
  errors: string[];
  pageNumber?: number;
}

export class DataExtractor {
  private page: Page;
  private results: ExtractionResult[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Extract data using a schema
   */
  async extract(schema: ExtractionSchema): Promise<ExtractionResult[]> {
    const results: ExtractionResult[] = [];
    let pageNum = 1;
    const maxPages = schema.pagination?.maxPages || 1;

    do {
      const result = await this.extractPage(schema, pageNum);
      results.push(result);

      if (schema.pagination?.nextSelector && pageNum < maxPages) {
        const hasNext = await this.goToNextPage(
          schema.pagination.nextSelector,
          schema.pagination.waitBetweenPages || 2000
        );
        if (!hasNext) break;
        pageNum++;
      } else {
        break;
      }
    } while (pageNum <= maxPages);

    this.results = results;
    return results;
  }

  /**
   * Extract data from current page
   */
  private async extractPage(schema: ExtractionSchema, pageNum: number): Promise<ExtractionResult> {
    const data: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const rule of schema.rules) {
      try {
        const value = await this.extractByRule(rule);
        data[rule.name] = value;
      } catch (error) {
        if (!rule.optional) {
          errors.push(`${rule.name}: ${(error as Error).message}`);
        }
        data[rule.name] = null;
      }
    }

    return {
      schemaId: schema.id,
      url: this.page.url(),
      timestamp: new Date().toISOString(),
      data,
      errors,
      pageNumber: pageNum,
    };
  }

  /**
   * Extract data by a single rule
   */
  private async extractByRule(rule: ExtractionRule): Promise<unknown> {
    let selector = rule.selector;
    
    // Try XPath if no CSS selector
    if (!selector && rule.xpath) {
      return this.extractByXPath(rule);
    }

    if (!selector) {
      throw new Error('No selector provided');
    }

    // Try fallback if main selector fails
    try {
      return await this.extractBySelector(rule, selector);
    } catch (error) {
      if (rule.fallbackSelector) {
        return this.extractBySelector(rule, rule.fallbackSelector);
      }
      throw error;
    }
  }

  /**
   * Extract by CSS selector
   */
  private async extractBySelector(rule: ExtractionRule, selector: string): Promise<unknown> {
    switch (rule.type) {
      case 'text':
        return this.extractText(selector, rule);
      case 'html':
        return this.extractHtml(selector, rule);
      case 'attribute':
        return this.extractAttribute(selector, rule);
      case 'value':
        return this.extractValue(selector, rule);
      case 'href':
        return this.extractAttribute(selector, { ...rule, attribute: 'href' });
      case 'src':
        return this.extractAttribute(selector, { ...rule, attribute: 'src' });
      case 'table':
        return this.extractTable(selector);
      case 'list':
        return this.extractList(selector, rule);
      case 'json':
        return this.extractJson(selector);
      case 'links':
        return this.extractLinks(selector);
      case 'images':
        return this.extractImages(selector);
      case 'form':
        return this.extractForm(selector);
      case 'metadata':
        return this.extractMetadata();
      case 'screenshot':
        return this.extractScreenshot(selector);
      default:
        return this.extractText(selector, rule);
    }
  }

  /**
   * Extract text content
   */
  private async extractText(selector: string, rule: ExtractionRule): Promise<string | string[]> {
    if (rule.multiple) {
      const elements = await this.page.$$(selector);
      const texts = await Promise.all(
        elements.map(el => el.textContent())
      );
      return texts.map(t => this.applyTransform(t || '', rule));
    }

    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    const text = await element.textContent();
    return this.applyTransform(text || '', rule);
  }

  /**
   * Extract HTML content
   */
  private async extractHtml(selector: string, rule: ExtractionRule): Promise<string | string[]> {
    if (rule.multiple) {
      const elements = await this.page.$$(selector);
      return Promise.all(
        elements.map(el => el.innerHTML())
      );
    }

    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    return element.innerHTML();
  }

  /**
   * Extract attribute value
   */
  private async extractAttribute(selector: string, rule: ExtractionRule): Promise<string | string[] | null> {
    const attr = rule.attribute || 'value';
    
    if (rule.multiple) {
      const elements = await this.page.$$(selector);
      return Promise.all(
        elements.map(el => el.getAttribute(attr))
      ) as Promise<string[]>;
    }

    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    return element.getAttribute(attr);
  }

  /**
   * Extract input value
   */
  private async extractValue(selector: string, rule: ExtractionRule): Promise<string | string[]> {
    if (rule.multiple) {
      const elements = await this.page.$$(selector);
      return Promise.all(
        elements.map(el => el.inputValue())
      );
    }

    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    return element.inputValue();
  }

  /**
   * Extract table data
   */
  private async extractTable(selector: string): Promise<Record<string, string>[]> {
    const rows = await this.page.$$(`${selector} tr`);
    const data: Record<string, string>[] = [];
    let headers: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const cells = await rows[i].$$('th, td');
      const cellTexts = await Promise.all(
        cells.map(cell => cell.textContent())
      );

      if (i === 0) {
        // First row as headers
        headers = cellTexts.map((t, idx) => (t?.trim() || `col_${idx}`));
      } else {
        const row: Record<string, string> = {};
        cellTexts.forEach((text, idx) => {
          row[headers[idx] || `col_${idx}`] = text?.trim() || '';
        });
        data.push(row);
      }
    }

    return data;
  }

  /**
   * Extract list items
   */
  private async extractList(selector: string, rule: ExtractionRule): Promise<unknown[]> {
    const items = await this.page.$$(selector);
    const data: unknown[] = [];

    for (const item of items) {
      if (rule.children && rule.children.length > 0) {
        // Extract nested data
        const itemData: Record<string, unknown> = {};
        for (const child of rule.children) {
          try {
            const childSelector = child.selector;
            if (childSelector) {
              const childElement = await item.$(childSelector);
              if (childElement) {
                itemData[child.name] = await this.extractFromElement(childElement, child);
              }
            }
          } catch {
            if (!child.optional) {
              itemData[child.name] = null;
            }
          }
        }
        data.push(itemData);
      } else {
        // Just extract text
        const text = await item.textContent();
        data.push(text?.trim() || '');
      }
    }

    return data;
  }

  /**
   * Extract from a specific element
   */
  private async extractFromElement(element: ElementHandle, rule: ExtractionRule): Promise<unknown> {
    switch (rule.type) {
      case 'text':
        return (await element.textContent())?.trim() || '';
      case 'html':
        return element.innerHTML();
      case 'attribute':
        return element.getAttribute(rule.attribute || 'value');
      case 'href':
        return element.getAttribute('href');
      case 'src':
        return element.getAttribute('src');
      default:
        return (await element.textContent())?.trim() || '';
    }
  }

  /**
   * Extract JSON from script tag or text
   */
  private async extractJson(selector: string): Promise<unknown> {
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    const text = await element.textContent();
    if (!text) return null;
    
    try {
      return JSON.parse(text);
    } catch {
      // Try to find JSON in text
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('Could not parse JSON');
    }
  }

  /**
   * Extract all links
   */
  private async extractLinks(selector: string = 'a[href]'): Promise<Array<{ text: string; href: string }>> {
    const links = await this.page.$$(selector);
    return Promise.all(
      links.map(async link => ({
        text: (await link.textContent())?.trim() || '',
        href: await link.getAttribute('href') || '',
      }))
    );
  }

  /**
   * Extract all images
   */
  private async extractImages(selector: string = 'img'): Promise<Array<{ alt: string; src: string }>> {
    const images = await this.page.$$(selector);
    return Promise.all(
      images.map(async img => ({
        alt: await img.getAttribute('alt') || '',
        src: await img.getAttribute('src') || '',
      }))
    );
  }

  /**
   * Extract form data
   */
  private async extractForm(selector: string): Promise<Record<string, unknown>> {
    const form = await this.page.$(selector);
    if (!form) throw new Error(`Form not found: ${selector}`);
    
    const inputs = await form.$$('input, select, textarea');
    const data: Record<string, unknown> = {};
    
    for (const input of inputs) {
      const name = await input.getAttribute('name');
      const type = await input.getAttribute('type');
      
      if (name) {
        if (type === 'checkbox' || type === 'radio') {
          data[name] = await input.isChecked();
        } else {
          data[name] = await input.inputValue().catch(() => null);
        }
      }
    }
    
    return data;
  }

  /**
   * Extract page metadata
   */
  private async extractMetadata(): Promise<Record<string, string | null>> {
    return this.page.evaluate(() => {
      const getMeta = (name: string) => {
        const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
        return el?.getAttribute('content') || null;
      };
      
      return {
        title: document.title,
        description: getMeta('description'),
        keywords: getMeta('keywords'),
        author: getMeta('author'),
        ogTitle: getMeta('og:title'),
        ogDescription: getMeta('og:description'),
        ogImage: getMeta('og:image'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
      };
    });
  }

  /**
   * Take screenshot of element
   */
  private async extractScreenshot(selector: string): Promise<string> {
    const element = await this.page.$(selector);
    if (!element) throw new Error(`Element not found: ${selector}`);
    
    const screenshot = await element.screenshot({ type: 'png' });
    return `data:image/png;base64,${screenshot.toString('base64')}`;
  }

  /**
   * Extract by XPath
   */
  private async extractByXPath(rule: ExtractionRule): Promise<unknown> {
    const elements = await this.page.$$(`xpath=${rule.xpath}`);
    
    if (elements.length === 0) {
      if (rule.optional) return null;
      throw new Error(`XPath not found: ${rule.xpath}`);
    }

    if (rule.multiple) {
      return Promise.all(
        elements.map(el => this.extractFromElement(el, rule))
      );
    }

    return this.extractFromElement(elements[0], rule);
  }

  /**
   * Apply transformation to value
   */
  private applyTransform(value: string, rule: ExtractionRule): string {
    let result = value;

    // Apply regex
    if (rule.regex) {
      const match = result.match(new RegExp(rule.regex));
      result = match ? match[1] || match[0] : result;
    }

    // Apply transform
    switch (rule.transform) {
      case 'trim':
        result = result.trim();
        break;
      case 'lowercase':
        result = result.toLowerCase();
        break;
      case 'uppercase':
        result = result.toUpperCase();
        break;
    }

    return result;
  }

  /**
   * Go to next page
   */
  private async goToNextPage(selector: string, waitTime: number): Promise<boolean> {
    try {
      const nextButton = await this.page.$(selector);
      if (!nextButton) return false;
      
      const isDisabled = await nextButton.getAttribute('disabled');
      if (isDisabled !== null) return false;
      
      await nextButton.click();
      await this.page.waitForLoadState('networkidle');
      await this.page.waitForTimeout(waitTime);
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Export results to JSON
   */
  toJSON(): string {
    return JSON.stringify(this.results, null, 2);
  }

  /**
   * Export results to CSV
   */
  toCSV(): string {
    if (this.results.length === 0) return '';
    
    const allData = this.results.flatMap(r => {
      if (Array.isArray(r.data)) return r.data;
      return [r.data];
    });

    if (allData.length === 0) return '';
    
    const headers = Object.keys(allData[0] as Record<string, unknown>);
    const rows = allData.map(row => 
      headers.map(h => {
        const val = (row as Record<string, unknown>)[h];
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      }).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Get results
   */
  getResults(): ExtractionResult[] {
    return this.results;
  }
}

/**
 * Quick extraction helper
 */
export async function quickExtract(
  page: Page,
  selectors: Record<string, string>
): Promise<Record<string, string | null>> {
  const results: Record<string, string | null> = {};
  
  for (const [name, selector] of Object.entries(selectors)) {
    try {
      const element = await page.$(selector);
      results[name] = element ? await element.textContent() : null;
    } catch {
      results[name] = null;
    }
  }
  
  return results;
}

