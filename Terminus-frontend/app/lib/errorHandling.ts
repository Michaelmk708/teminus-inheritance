/**
 * lib/errorHandling.ts
 * ────────────────────────────────────────────────────────────────
 * Robust error handling and retry logic for the frontend.
 *
 * All API calls, wallet interactions, and RPC queries should use
 * these utilities to provide graceful error recovery and user
 * feedback.
 *
 * ────────────────────────────────────────────────────────────────
 */

// ════════════════════════════════════════════════════════════════════
//  ERROR TYPES
// ════════════════════════════════════════════════════════════════════

export enum ErrorCategory {
  Network = "network",
  Wallet = "wallet",
  RPC = "rpc",
  Validation = "validation",
  Contract = "contract",
  Unknown = "unknown",
}

export interface ErrorDetails {
  category: ErrorCategory;
  code?: number;
  message: string;
  originalError?: Error;
  timestamp: string;
  retryable: boolean;
}

export class TerminusError extends Error {
  category: ErrorCategory;
  code?: number;
  retryable: boolean;
  timestamp: string;

  constructor(
    message: string,
    category: ErrorCategory = ErrorCategory.Unknown,
    options?: {
      code?: number;
      retryable?: boolean;
      originalError?: Error;
    }
  ) {
    super(message);
    this.name = "TerminusError";
    this.category = category;
    this.code = options?.code;
    this.retryable = options?.retryable ?? true;
    this.timestamp = new Date().toISOString();

    if (options?.originalError) {
      this.stack = options.originalError.stack;
    }
  }

  toJSON(): ErrorDetails {
    return {
      category: this.category,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      retryable: this.retryable,
    };
  }
}

// ════════════════════════════════════════════════════════════════════
//  ERROR CLASSIFICATION
// ════════════════════════════════════════════════════════════════════

/**
 * Classifies an error and determines if it's retryable.
 */
export function classifyError(error: unknown): TerminusError {
  if (error instanceof TerminusError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors (retryable)
    if (
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnrefused") ||
      message.includes("econnreset")
    ) {
      return new TerminusError(error.message, ErrorCategory.Network, {
        retryable: true,
        originalError: error,
      });
    }

    // RPC errors
    if (message.includes("rpc") || message.includes("solana")) {
      return new TerminusError(error.message, ErrorCategory.RPC, {
        retryable: message.includes("unavailable") || message.includes("timeout"),
        originalError: error,
      });
    }

    // Wallet errors
    if (
      message.includes("wallet") ||
      message.includes("phantom") ||
      message.includes("user rejected")
    ) {
      return new TerminusError(error.message, ErrorCategory.Wallet, {
        retryable: false,
        originalError: error,
      });
    }

    // Validation errors
    if (
      message.includes("invalid") ||
      message.includes("validation") ||
      message.includes("required")
    ) {
      return new TerminusError(error.message, ErrorCategory.Validation, {
        retryable: false,
        originalError: error,
      });
    }

    // Contract errors
    if (
      message.includes("contract") ||
      message.includes("anchor") ||
      message.includes("program")
    ) {
      return new TerminusError(error.message, ErrorCategory.Contract, {
        retryable: false,
        originalError: error,
      });
    }

    return new TerminusError(error.message, ErrorCategory.Unknown, {
      originalError: error,
    });
  }

  return new TerminusError(String(error), ErrorCategory.Unknown);
}

// ════════════════════════════════════════════════════════════════════
//  USER-FRIENDLY ERROR MESSAGES
// ════════════════════════════════════════════════════════════════════

export function getUserFriendlyMessage(error: TerminusError): string {
  switch (error.category) {
    case ErrorCategory.Network:
      return (
        "Network connection error. Please check your internet and try again."
      );

    case ErrorCategory.Wallet:
      if (error.message.includes("user rejected")) {
        return "Transaction was cancelled. Please try again.";
      }
      return "Wallet error. Please ensure your wallet is connected and funded.";

    case ErrorCategory.RPC:
      if (error.retryable) {
        return "Solana network is temporarily busy. Retrying...";
      }
      return "Cannot reach Solana. Try switching to Devnet or check your network.";

    case ErrorCategory.Validation:
      return `Invalid input: ${error.message}`;

    case ErrorCategory.Contract:
      return (
        "Smart contract error. The operation may not be allowed in the current vault state."
      );

    default:
      return error.message || "An unexpected error occurred. Please try again.";
  }
}

// ════════════════════════════════════════════════════════════════════
//  RETRY LOGIC
// ════════════════════════════════════════════════════════════════════

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitter: boolean;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 100,
  maxDelayMs: 2000,
  exponentialBase: 2,
  jitter: true,
};

function getRetryDelay(attempt: number, config: RetryConfig): number {
  let delay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt);
  delay = Math.min(delay, config.maxDelayMs);

  if (config.jitter) {
    delay *= 0.5 + Math.random();
  }

  return Math.round(delay);
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: Error) => void
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      const terminusError = classifyError(error);

      if (!terminusError.retryable || attempt === config.maxAttempts) {
        throw terminusError;
      }

      const delayMs = getRetryDelay(attempt, config);
      onRetry?.(attempt + 1, lastError);

      console.log(
        `[RETRY] Attempt ${attempt + 1}/${config.maxAttempts} failed. Retrying in ${delayMs}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError || new Error("Retry failed");
}

// ════════════════════════════════════════════════════════════════════
//  HTTP CLIENT WITH RETRY
// ════════════════════════════════════════════════════════════════════

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  return retryWithBackoff(
    async () => {
      const response = await fetch(url, options);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const error = new Error(
          data.detail || `HTTP ${response.status}: ${response.statusText}`
        );
        (error as any).status = response.status;
        throw error;
      }

      return response;
    },
    retryConfig
  );
}

// ════════════════════════════════════════════════════════════════════
//  ERROR LOGGER
// ════════════════════════════════════════════════════════════════════

interface LogEntry {
  timestamp: string;
  category: ErrorCategory;
  message: string;
  retryable: boolean;
}

class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  log(error: TerminusError): void {
    this.logs.push({
      timestamp: error.timestamp,
      category: error.category,
      message: error.message,
      retryable: error.retryable,
    });

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    console.error(`[${error.category.toUpperCase()}] ${error.message}`);
  }

  getRecent(limit: number = 10): LogEntry[] {
    return this.logs.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }

  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export const errorLogger = new ErrorLogger();

// ════════════════════════════════════════════════════════════════════
//  SAFE ASYNC WRAPPER
// ════════════════════════════════════════════════════════════════════

/**
 * Wraps an async operation with error handling.
 * Returns [result, error] tuple (Rust-like error handling).
 *
 * @example
 * const [vaultState, error] = await safeAsync(() =>
 *   fetch('/api/vault/...').then(r => r.json())
 * );
 *
 * if (error) {
 *   console.error(getUserFriendlyMessage(error));
 *   return;
 * }
 *
 * // Use vaultState safely
 */
export async function safeAsync<T>(
  fn: () => Promise<T>
): Promise<[T | null, TerminusError | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    const terminusError = classifyError(error);
    errorLogger.log(terminusError);
    return [null, terminusError];
  }
}
