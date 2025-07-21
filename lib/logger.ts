// Production-ready logger utility
// In production, this can be replaced with services like Winston, Pino, or cloud logging

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV !== 'production';
  private logLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  
  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.logLevel];
  }
  
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
  }
  
  private log(level: LogLevel, message: string, context?: LogContext) {
    if (!this.shouldLog(level)) return;
    
    const formattedMessage = this.formatMessage(level, message, context);
    
    // In production, send to logging service
    if (!this.isDevelopment) {
      // TODO: Send to logging service (e.g., CloudWatch, Datadog, etc.)
      // For now, we'll use console methods that are appropriate for production
      switch (level) {
        case 'error':
          console.error(formattedMessage);
          break;
        case 'warn':
          console.warn(formattedMessage);
          break;
        default:
          console.log(formattedMessage);
      }
    } else {
      // In development, use console with colors
      switch (level) {
        case 'error':
          console.error('\x1b[31m%s\x1b[0m', formattedMessage); // Red
          break;
        case 'warn':
          console.warn('\x1b[33m%s\x1b[0m', formattedMessage); // Yellow
          break;
        case 'info':
          console.info('\x1b[36m%s\x1b[0m', formattedMessage); // Cyan
          break;
        case 'debug':
          console.debug('\x1b[90m%s\x1b[0m', formattedMessage); // Gray
          break;
      }
    }
  }
  
  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }
  
  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }
  
  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }
  
  error(message: string, error?: Error | unknown, context?: LogContext) {
    const errorContext = { ...context };
    
    if (error instanceof Error) {
      errorContext.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      };
    } else if (error) {
      errorContext.error = error;
    }
    
    this.log('error', message, errorContext);
  }
}

// Export singleton instance
export const logger = new Logger();

// Export for testing or custom instances
export { Logger };