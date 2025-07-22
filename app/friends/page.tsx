import { Metadata } from 'next';
import FriendsList from '@/components/social/FriendsList';
import TopNav from '@/components/TopNav';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Friends | Whiskey Vault',
  description: 'Connect with friends and share your whiskey journey',
};

export default async function FriendsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <TopNav />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-gray-900 dark:text-white">
            My Friends
          </h1>
          
          <FriendsList />
        </div>
      </div>
    </div>
  );
}