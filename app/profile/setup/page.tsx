import { Metadata } from 'next';
import ProfileSetup from '@/components/ProfileSetup';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export const metadata: Metadata = {
  title: 'Setup Profile | Whiskey Vault',
  description: 'Set up your social profile to connect with friends',
};

export default async function ProfileSetupPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  // Check if user already has a username
  await dbConnect();
  const user = await User.findOne({ email: session.user.email }).select('username');
  
  if (user?.username) {
    redirect(`/profile/${user.username}`);
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to Whiskey Vault Social!</h1>
          <p className="text-gray-400 mb-8">
            Set up your profile to connect with friends, share your collection, and discover new whiskeys together.
          </p>
          
          <ProfileSetup />
        </div>
      </div>
    </div>
  );
}