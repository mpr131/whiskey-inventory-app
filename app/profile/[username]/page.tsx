import { notFound } from 'next/navigation';
import PublicProfile from '@/components/social/PublicProfile';
import TopNav from '@/components/TopNav';

interface ProfilePageProps {
  params: {
    username: string;
  };
}

export async function generateMetadata({ params }: ProfilePageProps) {
  return {
    title: `${params.username} | Whiskey Vault`,
    description: `View ${params.username}'s whiskey collection and tasting journey`,
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  return (
    <div className="min-h-screen bg-gray-900">
      <TopNav />
      <div className="container mx-auto px-4 py-8">
        <PublicProfile username={params.username} />
      </div>
    </div>
  );
}