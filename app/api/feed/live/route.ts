import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import Friendship from '@/models/Friendship';
import LivePour from '@/models/LivePour';

// GET endpoint for Server-Sent Events (SSE)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get user's friends
    const friendships = await Friendship.find({
      $and: [
        { status: 'accepted' },
        {
          $or: [
            { requester: user._id },
            { recipient: user._id },
          ],
        },
      ],
    });

    const friendIds = friendships.map(f => {
      const isRequester = f.requester.toString() === user._id.toString();
      return isRequester ? f.recipient.toString() : f.requester.toString();
    });

    // Include user's own ID to see their own live pours
    friendIds.push(user._id.toString());

    // Create SSE response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial data
        const initialPours = await LivePour.find({
          userId: { $in: friendIds },
          isActive: true,
        }).sort({ startedAt: -1 });

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'initial', pours: initialPours })}\n\n`)
        );

        // Set up interval to check for updates
        const intervalId = setInterval(async () => {
          try {
            const activePours = await LivePour.find({
              userId: { $in: friendIds },
              isActive: true,
            }).sort({ startedAt: -1 });

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'update', pours: activePours })}\n\n`)
            );
          } catch (error) {
            console.error('SSE update error:', error);
          }
        }, 5000); // Update every 5 seconds

        // Clean up on close
        request.signal.addEventListener('abort', () => {
          clearInterval(intervalId);
          controller.close();
        });
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Live feed error:', error);
    return NextResponse.json(
      { error: 'Failed to establish live feed' },
      { status: 500 }
    );
  }
}

// POST endpoint to start a live pour
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { bottleId, bottleName, bottleImage, location, sessionId } = await request.json();

    if (!bottleId || !bottleName || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // End any existing active pours for this session
    await (LivePour as any).endPour(sessionId);

    // Create new live pour
    const livePour = await LivePour.create({
      userId: user._id,
      userName: user.displayName || user.name,
      userAvatar: user.avatar,
      bottleId,
      bottleName,
      bottleImage,
      location,
      sessionId,
      isActive: true,
    });

    // Create activity for live pour start
    const Activity = await import('@/models/Activity').then(m => m.default);
    await Activity.create({
      userId: user._id,
      type: 'live_pour_start',
      targetId: livePour._id,
      metadata: {
        bottleName,
        bottleImage,
        location,
        sessionId,
      },
    });

    return NextResponse.json({
      message: 'Live pour started',
      livePour,
    });
  } catch (error) {
    console.error('Start live pour error:', error);
    return NextResponse.json(
      { error: 'Failed to start live pour' },
      { status: 500 }
    );
  }
}

// PUT endpoint to end a live pour
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const user = await User.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    // End the live pour
    const result = await (LivePour as any).endPour(sessionId);

    // Create activity for live pour end
    const Activity = await import('@/models/Activity').then(m => m.default);
    const livePour = await LivePour.findOne({ sessionId, userId: user._id });
    
    if (livePour) {
      await Activity.create({
        userId: user._id,
        type: 'live_pour_end',
        targetId: livePour._id,
        metadata: {
          bottleName: livePour.bottleName,
          bottleImage: livePour.bottleImage,
          location: livePour.location,
          sessionId,
        },
      });
    }

    return NextResponse.json({
      message: 'Live pour ended',
      result,
    });
  } catch (error) {
    console.error('End live pour error:', error);
    return NextResponse.json(
      { error: 'Failed to end live pour' },
      { status: 500 }
    );
  }
}