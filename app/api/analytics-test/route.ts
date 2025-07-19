import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';

export async function GET(request: Request) {
  console.log('Analytics test API called');
  
  try {
    // Test 1: Authentication
    console.log('Testing authentication...');
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized', test: 'auth' }, { status: 401 });
    }
    console.log('Auth successful, user:', session.user.id);

    // Test 2: Database connection
    console.log('Testing database connection...');
    await dbConnect();
    console.log('Database connected');

    // Test 3: Simple query
    console.log('Testing simple query...');
    const tonight = new Date();
    tonight.setHours(tonight.getHours() - 24);
    
    const pourCount = await Pour.countDocuments({
      userId: session.user.id,
      createdAt: { $gte: tonight }
    });
    console.log('Pour count for tonight:', pourCount);

    // Return minimal data
    return NextResponse.json({
      success: true,
      tests: {
        auth: 'passed',
        database: 'connected',
        query: 'completed'
      },
      data: {
        tonightsPourCount: pourCount,
        userId: session.user.id
      }
    });

  } catch (error) {
    console.error('Test API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}