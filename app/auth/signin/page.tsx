'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignInPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const inviteCode = formData.get('inviteCode') as string;

    try {
      // Build credentials object
      const credentials: any = {
        email,
        password,
        redirect: false,
      };

      // Only add name and inviteCode if registering
      if (isRegistering) {
        credentials.name = name;
        credentials.inviteCode = inviteCode;
      }

      console.log('🚀 Signin attempt:', {
        email,
        isRegistering,
        hasName: !!name,
        hasInviteCode: !!inviteCode,
        credentials,
      });

      const result = await signIn('credentials', credentials);

      console.log('📨 Signin result:', result);

      if (result?.error) {
        console.error('❌ Signin error:', result.error);
        setError(result.error);
      } else {
        console.log('✅ Signin successful, redirecting...');
        router.push('/dashboard');
        router.refresh();
      }
    } catch (error) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 premium-gradient opacity-90"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="card-premium backdrop-blur-2xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gradient mb-2">Whiskey Vault</h1>
            <p className="text-gray-400">Premium Collection Management</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isRegistering && (
              <>
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required={isRegistering}
                    className="input-premium w-full"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-300 mb-2">
                    Invite Code
                  </label>
                  <input
                    id="inviteCode"
                    name="inviteCode"
                    type="text"
                    required={isRegistering}
                    className="input-premium w-full uppercase"
                    placeholder="XXXX-XXXX"
                    maxLength={8}
                  />
                </div>
              </>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="input-premium w-full"
                placeholder="john@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                className="input-premium w-full"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full relative overflow-hidden group"
            >
              <span className="relative z-10">
                {isLoading ? 'Processing...' : (isRegistering ? 'Create Account' : 'Sign In')}
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-copper-dark to-copper opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError('');
              }}
              className="text-copper-light hover:text-copper transition-colors duration-200"
            >
              {isRegistering ? 'Already have an account? Sign in' : "Don't have an account? Register"}
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-center text-sm text-gray-500">
              By signing in, you agree to our{' '}
              <Link href="/terms" className="text-copper-light hover:text-copper">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="text-copper-light hover:text-copper">
                Privacy Policy
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400">
            Need an invite code?{' '}
            <Link href="/request-invite" className="text-copper-light hover:text-copper">
              Request Access
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}