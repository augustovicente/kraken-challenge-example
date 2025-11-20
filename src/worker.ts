#!/usr/bin/env node

/**
 * Worker Process
 * Standalone script to run the worker service
 * Usage: npm run worker
 */

import 'dotenv/config';
import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';

import { WorkerModule } from './infrastructure/WorkerModule';

const logger = new Logger('WorkerBootstrap');

async function bootstrap() {
  try {
    logger.log('Starting worker process...');

    // Create the NestJS application with WorkerModule
    const app = await NestFactory.createApplicationContext(WorkerModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Initialize database connection
    const dataSource = app.get(DataSource);
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      logger.log('Database connection initialized');
    }

    // The WorkerService will start automatically via OnModuleInit
    logger.log('Worker process is running. Press Ctrl+C to stop.');

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.log('Received SIGINT, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.log('Received SIGTERM, shutting down gracefully...');
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start worker process:', error);
    process.exit(1);
  }
}

bootstrap();
