export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

interface LogMetadata {
  [key: string]: unknown;
}

interface LoggerConfig {
  minLevel: LogLevel;
  enableConsole: boolean;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;

  private constructor() {
    this.config = {
      minLevel:
        process.env.NODE_ENV === "production" ? LogLevel.INFO : LogLevel.DEBUG,
      enableConsole: true,
    };
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = Object.values(LogLevel);
    return levels.indexOf(level) >= levels.indexOf(this.config.minLevel);
  }

  private formatMessage(
    level: LogLevel,
    message: string,
    metadata?: LogMetadata,
  ): string {
    const timestamp = new Date().toISOString();
    const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : "";
    return `[${timestamp}] ${level}: ${message}${metadataStr}`;
  }

  public setConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public debug(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, metadata));
    }
  }

  public info(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, metadata));
    }
  }

  public warn(message: string, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, metadata));
    }
  }

  public error(message: string, error?: Error, metadata?: LogMetadata): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const enhancedMetadata = {
        ...metadata,
        ...(error && {
          errorName: error.name,
          errorStack: error.stack,
        }),
      };
      console.error(
        this.formatMessage(LogLevel.ERROR, message, enhancedMetadata),
      );
    }
  }
}

export const logger = Logger.getInstance();
