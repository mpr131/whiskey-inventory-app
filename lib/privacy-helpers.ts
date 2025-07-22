import Friendship from '@/models/Friendship';
import { Types } from 'mongoose';

export interface PrivacySettings {
  showCollection: 'public' | 'friends' | 'private';
  showPours: 'public' | 'friends' | 'private';
  showRatings: 'public' | 'friends' | 'private';
  showValue: 'never';
}

/**
 * Check if a user can view another user's content based on privacy settings
 */
export async function canViewContent(
  viewerId: string | Types.ObjectId | null,
  ownerId: string | Types.ObjectId,
  contentType: keyof PrivacySettings,
  privacySettings: PrivacySettings
): Promise<boolean> {
  // Owner can always see their own content
  if (viewerId && viewerId.toString() === ownerId.toString()) {
    return true;
  }

  const privacySetting = privacySettings[contentType];

  // Never show value
  if (contentType === 'showValue') {
    return false;
  }

  // Public content is visible to everyone
  if (privacySetting === 'public') {
    return true;
  }

  // Private content is only visible to owner
  if (privacySetting === 'private') {
    return false;
  }

  // Friends-only content requires friendship check
  if (privacySetting === 'friends' && viewerId) {
    const areFriends = await (Friendship as any).areFriends(
      viewerId.toString(),
      ownerId.toString()
    );
    return areFriends;
  }

  return false;
}

/**
 * Filter sensitive data from user objects based on privacy settings
 */
export function filterUserData(
  user: any,
  viewerId: string | null,
  isFriend: boolean
) {
  const isOwner = viewerId && user._id.toString() === viewerId;
  
  // Always remove sensitive data
  const filtered = {
    ...user.toObject ? user.toObject() : user,
    password: undefined,
    resetPasswordToken: undefined,
    resetPasswordExpiry: undefined,
    inviteCodeUsed: undefined,
  };

  // Remove financial data unless owner
  if (!isOwner) {
    delete filtered.stats?.totalValue;
  }

  // Apply privacy settings
  if (!isOwner) {
    const privacy = filtered.privacy || {
      showCollection: 'friends',
      showPours: 'friends',
      showRatings: 'friends',
      showValue: 'never',
    };

    // Check collection visibility
    if (privacy.showCollection === 'private' || 
        (privacy.showCollection === 'friends' && !isFriend)) {
      delete filtered.stats?.bottleCount;
      delete filtered.stats?.uniqueBottles;
    }

    // Check pour visibility
    if (privacy.showPours === 'private' || 
        (privacy.showPours === 'friends' && !isFriend)) {
      delete filtered.stats?.totalPours;
      delete filtered.stats?.favoriteBrand;
    }
  }

  return filtered;
}

/**
 * Get friend status between two users
 */
export async function getFriendshipStatus(
  userId1: string | Types.ObjectId,
  userId2: string | Types.ObjectId
): Promise<'none' | 'pending' | 'accepted' | 'blocked'> {
  const friendship = await Friendship.findOne({
    $or: [
      { requester: userId1, recipient: userId2 },
      { requester: userId2, recipient: userId1 },
    ],
  });

  return friendship ? friendship.status : 'none';
}

/**
 * Get all friend IDs for a user
 */
export async function getFriendIds(userId: string | Types.ObjectId): Promise<string[]> {
  const friendships = await Friendship.find({
    $and: [
      { status: 'accepted' },
      {
        $or: [
          { requester: userId },
          { recipient: userId },
        ],
      },
    ],
  });

  return friendships.map(f => {
    const isRequester = f.requester.toString() === userId.toString();
    return isRequester ? f.recipient.toString() : f.requester.toString();
  });
}