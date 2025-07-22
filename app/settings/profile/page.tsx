import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProfileSettings from '@/components/ProfileSettings';
import TopNav from '@/components/TopNav';

export const metadata: Metadata = {
  title: 'Profile Settings | Whiskey Vault',
  description: 'Manage your profile and privacy settings',
};

export default async function ProfileSettingsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <TopNav />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>
          <ProfileSettings />
        </div>
      </div>
    </div>
  );
}