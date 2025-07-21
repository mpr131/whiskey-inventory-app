import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import NotificationModel from '@/models/Notification';
import type { Notification } from '@/types/notifications';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Get user's notifications
    const notifications = await NotificationModel
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();


    // Transform MongoDB documents
    const transformedNotifications = notifications.map((n: any) => ({
      id: n._id.toString(),
      userId: n.userId,
      type: n.type,
      priority: n.priority,
      title: n.title,
      message: n.message,
      data: n.data,
      read: n.read,
      createdAt: n.createdAt,
      expiresAt: n.expiresAt,
      actionUrl: n.actionUrl,
      icon: n.icon
    }));

    return NextResponse.json({ notifications: transformedNotifications });
  } catch (error) {
    console.error('Error in notifications API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, priority, title, message, data, actionUrl, icon, expiresAt } = body;

    if (!type || !title || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, message' },
        { status: 400 }
      );
    }

    await dbConnect();
    
    const notification = await NotificationModel.create({
      userId: session.user.id,
      type,
      priority: priority || 'medium',
      title,
      message,
      data: data || null,
      read: false,
      actionUrl: actionUrl || null,
      icon: icon || null,
      expiresAt: expiresAt || null
    });

    return NextResponse.json({ 
      notification: {
        id: notification._id.toString(),
        userId: notification.userId,
        type: notification.type,
        priority: notification.priority,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        read: notification.read,
        createdAt: notification.createdAt,
        expiresAt: notification.expiresAt,
        actionUrl: notification.actionUrl,
        icon: notification.icon
      }
    });
  } catch (error) {
    console.error('Error in create notification API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}