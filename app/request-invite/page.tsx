'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RequestInvitePage() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the request to an API
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 premium-gradient opacity-90"></div>
      
      <div className="relative z-10 w-full max-w-md">
        <div className="card-premium backdrop-blur-2xl">
          {!isSubmitted ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gradient mb-2">Request Access</h1>
                <p className="text-gray-400">Join the exclusive Whiskey Vault community</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                    Full Name
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    className="input-premium w-full"
                    placeholder="John Doe"
                  />
                </div>

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
                  <label htmlFor="reason" className="block text-sm font-medium text-gray-300 mb-2">
                    Tell us about your collection
                  </label>
                  <textarea
                    id="reason"
                    name="reason"
                    rows={4}
                    required
                    className="input-premium w-full resize-none"
                    placeholder="I'm a whiskey enthusiast with a collection of..."
                  />
                </div>

                <button type="submit" className="btn-primary w-full">
                  Submit Request
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/auth/signin" className="text-copper-light hover:text-copper transition-colors">
                  Already have an invite code? Sign in
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center">
              <div className="text-green-400 mb-6">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-white mb-4">Request Submitted!</h2>
              
              <p className="text-gray-400 mb-8">
                Thank you for your interest in Whiskey Vault. We&apos;ll review your request and send an invite code to your email if approved.
              </p>

              <Link href="/" className="btn-secondary inline-flex items-center justify-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Back to Home
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}