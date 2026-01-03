/**
 * Type declarations for jstat library
 * @see https://github.com/jstat/jstat
 */

declare module 'jstat' {
  export interface jStatNormal {
    pdf(x: number, mean: number, std: number): number;
    cdf(x: number, mean: number, std: number): number;
    inv(p: number, mean: number, std: number): number;
    mean(mean: number, std: number): number;
    median(mean: number, std: number): number;
    mode(mean: number, std: number): number;
    sample(mean: number, std: number): number;
    variance(mean: number, std: number): number;
  }

  export interface jStatBeta {
    pdf(x: number, alpha: number, beta: number): number;
    cdf(x: number, alpha: number, beta: number): number;
    inv(p: number, alpha: number, beta: number): number;
    mean(alpha: number, beta: number): number;
    median(alpha: number, beta: number): number;
    mode(alpha: number, beta: number): number;
    sample(alpha: number, beta: number): number;
    variance(alpha: number, beta: number): number;
  }

  export interface jStatExponential {
    pdf(x: number, rate: number): number;
    cdf(x: number, rate: number): number;
    inv(p: number, rate: number): number;
    mean(rate: number): number;
    median(rate: number): number;
    mode(rate: number): number;
    sample(rate: number): number;
    variance(rate: number): number;
  }

  export interface jStatUniform {
    pdf(x: number, a: number, b: number): number;
    cdf(x: number, a: number, b: number): number;
    inv(p: number, a: number, b: number): number;
    mean(a: number, b: number): number;
    median(a: number, b: number): number;
    mode(a: number, b: number): number;
    sample(a: number, b: number): number;
    variance(a: number, b: number): number;
  }

  export const jStat: {
    normal: jStatNormal;
    beta: jStatBeta;
    exponential: jStatExponential;
    uniform: jStatUniform;
    mean(arr: number[]): number;
    median(arr: number[]): number;
    mode(arr: number[]): number;
    range(arr: number[]): number;
    variance(arr: number[], flag?: boolean): number;
    stdev(arr: number[], flag?: boolean): number;
    sum(arr: number[]): number;
    product(arr: number[]): number;
    min(arr: number[]): number;
    max(arr: number[]): number;
  };
}


