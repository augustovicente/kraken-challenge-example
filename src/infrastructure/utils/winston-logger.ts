import * as winston from 'winston';

import { redact } from './logger';

/**
 * Custom format that redacts sensitive information
 */
const redactFormat = winston.format(info => {
  if (info.message) {
    info.message = redact(info.message);
  }

  // Redact metadata
  if (info.metadata) {
    info.metadata = redact(info.metadata);
  }

  // Redact error stack traces
  if (info.stack) {
    info.stack = redact(info.stack);
  }

  return info;
});

/**
 * Create a Winston logger instance with structured logging and redaction
 */
export function createWinstonLogger(context?: string) {
  const logLevel = process.env.LOG_LEVEL || 'info';
  const redactionEnabled = process.env.REDACT_SENSITIVE_LOGS !== 'false';

  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
  ];

  // Add redaction format if enabled
  if (redactionEnabled) {
    formats.push(redactFormat());
  }

  // Add JSON format for structured logs
  formats.push(
    winston.format.printf(({ timestamp, level, message, context: ctx, ...metadata }) => {
      const contextStr = ctx || context || 'Application';
      let msg = `${timestamp} [${level.toUpperCase()}] [${contextStr}] ${message}`;

      // Add metadata if present
      if (Object.keys(metadata).length > 0) {
        msg += `\n${JSON.stringify(metadata, null, 2)}`;
      }

      return msg;
    }),
  );

  const logger = winston.createLogger({
    level: logLevel,
    format: winston.format.combine(...formats),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(winston.format.colorize(), ...formats),
      }),
    ],
  });

  // Add file transports in production
  if (process.env.NODE_ENV === 'production') {
    logger.add(
      new winston.transports.File({
        filename: 'logs/error.log',
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );
    logger.add(
      new winston.transports.File({
        filename: 'logs/combined.log',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),
    );
  }

  return logger;
}

/**
 * Wrapper class that provides a consistent interface
 */
export class WinstonLogger {
  private logger: winston.Logger;
  private context: string;

  constructor(context?: string) {
    this.context = context || 'Application';
    this.logger = createWinstonLogger(this.context);
  }

  log(message: string, metadata?: any): void {
    this.logger.info(message, { context: this.context, ...metadata });
  }

  error(message: string, trace?: string | Error, metadata?: any): void {
    if (trace instanceof Error) {
      this.logger.error(message, {
        context: this.context,
        error: trace.message,
        stack: trace.stack,
        ...metadata,
      });
    } else {
      this.logger.error(message, {
        context: this.context,
        stack: trace,
        ...metadata,
      });
    }
  }

  warn(message: string, metadata?: any): void {
    this.logger.warn(message, { context: this.context, ...metadata });
  }

  debug(message: string, metadata?: any): void {
    this.logger.debug(message, { context: this.context, ...metadata });
  }

  verbose(message: string, metadata?: any): void {
    this.logger.verbose(message, { context: this.context, ...metadata });
  }

  setContext(context: string): void {
    this.context = context;
  }
}

/**
 * Create a logger instance
 */
export function createLogger(context?: string): WinstonLogger {
  return new WinstonLogger(context);
}
