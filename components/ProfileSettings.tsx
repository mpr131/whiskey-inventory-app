'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Lock, Users as UsersIcon, AlertCircle, Save } from 'lucide-react';

interface ProfileData {
  username: string;
  displayName: string;
  bio: string;
  avatar?: string;
  privacy: {
    showCollection: 'public' | 'friends' | 'private';
    showPours: 'public' | 'friends' | 'private';
    showRatings: 'public' | 'friends' | 'private';
  };
}

export default function ProfileSettings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<ProfileData | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      const data = await response.json();
      
      if (response.ok) {
        setFormData({
          username: data.username || '',
          displayName: data.displayName || '',
          bio: data.bio || '',
          avatar: data.avatar,
          privacy: data.privacy || {
            showCollection: 'friends',
            showPours: 'friends',
            showRatings: 'friends',
          }
        });
      }
    } catch (error) {
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: formData.displayName,
          bio: formData.bio,
          privacy: formData.privacy,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const privacyOptions = [
    { value: 'public', label: 'Public', icon: Globe, description: 'Anyone can see' },
    { value: 'friends', label: 'Friends Only', icon: UsersIcon, description: 'Only friends can see' },
    { value: 'private', label: 'Private', icon: Lock, description: 'Only you can see' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-400 border-t-transparent" />
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Failed to load profile settings</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Profile Info */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              disabled
              className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              placeholder="Your display name"
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Bio
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell others about your whiskey journey..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500">{formData.bio.length}/500 characters</p>
          </div>
        </div>
      </div>

      {/* Privacy Settings */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Privacy Settings</h2>
        <p className="text-gray-400 mb-6">
          Control who can see your whiskey journey. Collection value is always private.
        </p>

        <div className="space-y-6">
          {[
            { key: 'showCollection', label: 'Who can see your collection?' },
            { key: 'showPours', label: 'Who can see your pour history?' },
            { key: 'showRatings', label: 'Who can see your ratings?' },
          ].map(setting => (
            <div key={setting.key}>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                {setting.label}
              </label>
              <div className="grid grid-cols-3 gap-3">
                {privacyOptions.map(option => {
                  const Icon = option.icon;
                  const isSelected = formData.privacy[setting.key as keyof typeof formData.privacy] === option.value;
                  
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        privacy: { 
                          ...formData.privacy, 
                          [setting.key]: option.value as any 
                        }
                      })}
                      className={`
                        p-4 rounded-lg border-2 transition-all
                        ${isSelected 
                          ? 'border-amber-500 bg-amber-500/10' 
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                        }
                      `}
                    >
                      <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? 'text-amber-500' : 'text-gray-400'}`} />
                      <p className={`font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                        {option.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </p>
        </div>
      )}

      {success && (
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <p className="text-green-400">Profile updated successfully!</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </form>
  );
}