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

export default async function ProfileSettingsPage({
  searchParams,
}: {
  searchParams: { setup?: string };
}) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect('/auth/signin');
  }

  const isFirstTimeSetup = searchParams.setup === 'true';

  return (
    <div className="min-h-screen bg-gray-900">
      <TopNav />
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {isFirstTimeSetup && (
            <div className="mb-8 p-6 bg-amber-900/20 border border-amber-600/40 rounded-lg">
              <h2 className="text-xl font-semibold text-amber-400 mb-2">
                Welcome to Whiskey Vault! 🥃
              </h2>
              <p className="text-gray-300">
                Please set up your profile to use social features. A unique username is required to connect with other whiskey enthusiasts.
              </p>
            </div>
          )}
          <h1 className="text-3xl font-bold text-white mb-8">Profile Settings</h1>
          <ProfileSettings />
        </div>
      </div>
    </div>
  );
}