import { NextResponse } from 'next/server';
import mongoose from 'mongoose';

export async function GET() {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      readyState: mongoose.connection.readyState,
    },
    environment: process.env.NODE_ENV,
  };

  const httpStatus = health.mongodb.connected ? 200 : 503;

  return NextResponse.json(health, { status: httpStatus });
}