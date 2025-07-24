'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { User, Lock, Globe, Users as UsersIcon, AlertCircle, CheckCircle } from 'lucide-react';

interface PrivacySettings {
  showCollection: 'public' | 'friends' | 'private';
  showPours: 'public' | 'friends' | 'private';
  showRatings: 'public' | 'friends' | 'private';
}

export default function ProfileSetup() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    displayName: session?.user?.name || '',
    bio: '',
    privacy: {
      showCollection: 'friends' as const,
      showPours: 'friends' as const,
      showRatings: 'friends' as const,
    }
  });

  // Check username availability
  const checkUsername = async (username: string) => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const response = await fetch(`/api/users/${username}`);
      setUsernameAvailable(response.status === 404);
    } catch (error) {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setFormData({ ...formData, username: value });
    
    // Debounce username check
    const timeoutId = setTimeout(() => {
      checkUsername(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || formData.username.length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (usernameAvailable === false) {
      setError('Username is already taken');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      // Update the session with the new username
      await update({ username: formData.username });

      // Redirect to new profile
      router.push(`/profile/${formData.username}`);
    } catch (error: any) {
      setError(error.message || 'Failed to set up profile');
    } finally {
      setLoading(false);
    }
  };

  const privacyOptions = [
    { value: 'public', label: 'Public', icon: Globe, description: 'Anyone can see' },
    { value: 'friends', label: 'Friends Only', icon: UsersIcon, description: 'Only friends can see' },
    { value: 'private', label: 'Private', icon: Lock, description: 'Only you can see' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Username */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Choose Your Username</h2>
        
        <div className="relative">
          <input
            type="text"
            value={formData.username}
            onChange={handleUsernameChange}
            placeholder="username"
            className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-z0-9_]+"
          />
          
          {formData.username.length >= 3 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checkingUsername ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent" />
              ) : usernameAvailable === true ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : usernameAvailable === false ? (
                <AlertCircle className="w-5 h-5 text-red-500" />
              ) : null}
            </div>
          )}
        </div>
        
        <p className="mt-2 text-sm text-gray-400">
          Your profile URL will be: /profile/{formData.username || 'username'}
        </p>
      </div>

      {/* Display Name & Bio */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-white mb-4">Profile Details</h2>
        
        <div className="space-y-4">
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
              Bio (optional)
            </label>
            <textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Tell others about your whiskey journey..."
              rows={4}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none"
              maxLength={500}
            />
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
          {/* Collection Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Who can see your collection?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {privacyOptions.map(option => {
                const Icon = option.icon;
                const isSelected = formData.privacy.showCollection === option.value;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      privacy: { ...formData.privacy, showCollection: option.value as any }
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

          {/* Pour History Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Who can see your pour history?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {privacyOptions.map(option => {
                const Icon = option.icon;
                const isSelected = formData.privacy.showPours === option.value;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      privacy: { ...formData.privacy, showPours: option.value as any }
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

          {/* Ratings Privacy */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Who can see your ratings?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {privacyOptions.map(option => {
                const Icon = option.icon;
                const isSelected = formData.privacy.showRatings === option.value;
                
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      privacy: { ...formData.privacy, showRatings: option.value as any }
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
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <p className="text-red-400 flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            {error}
          </p>
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !formData.username || usernameAvailable === false}
          className="px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
              Setting up...
            </>
          ) : (
            <>
              <User className="w-5 h-5" />
              Complete Setup
            </>
          )}
        </button>
      </div>
    </form>
  );
}