'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Plus, Copy, Trash2, Check, X, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';

interface InviteCode {
  _id: string;
  code: string;
  usedBy?: string;
  createdBy: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function InviteCodesPage() {
  const { data: session } = useSession();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchInviteCodes();
  }, []);

  const fetchInviteCodes = async () => {
    try {
      const response = await fetch('/api/invite-codes');
      if (!response.ok) throw new Error('Failed to fetch invite codes');
      const data = await response.json();
      setInviteCodes(data.codes || []);
    } catch (error) {
      console.error('Error fetching invite codes:', error);
      toast.error('Failed to load invite codes');
      setInviteCodes([]);
    } finally {
      setLoading(false);
    }
  };

  const generateInviteCode = async () => {
    setGenerating(true);
    try {
      const response = await fetch('/api/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresIn: 7,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate invite code');
      
      const data = await response.json();
      const newCode = data.inviteCode;
      setInviteCodes([newCode, ...inviteCodes]);
      toast.success('Invite code generated successfully!');
    } catch (error) {
      console.error('Error generating invite code:', error);
      toast.error('Failed to generate invite code');
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast.error('Failed to copy code');
    }
  };

  const deleteInviteCode = async (code: string) => {
    if (!confirm('Are you sure you want to deactivate this invite code?')) return;

    try {
      const response = await fetch(`/api/invite-codes/${code}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to deactivate invite code');
      
      // Update the code's isActive status in the list
      setInviteCodes(inviteCodes.map(inviteCode => 
        inviteCode.code === code 
          ? { ...inviteCode, isActive: false }
          : inviteCode
      ));
      toast.success('Invite code deactivated');
    } catch (error) {
      console.error('Error deactivating invite code:', error);
      toast.error('Failed to deactivate invite code');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-copper">Loading invite codes...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Invite Codes</h1>
        <p className="text-gray-400">
          Generate and manage invite codes for new users to join Whiskey Vault.
        </p>
      </div>

      {/* Generate Button */}
      <div className="mb-6">
        <button
          onClick={generateInviteCode}
          disabled={generating}
          className="bg-copper hover:bg-copper-dark text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-5 w-5" />
          {generating ? 'Generating...' : 'Generate New Code'}
        </button>
      </div>

      {/* Invite Codes Table */}
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-700 text-gray-300">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Expires
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Used By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {inviteCodes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-400">
                    No invite codes yet. Generate your first code!
                  </td>
                </tr>
              ) : (
                inviteCodes.map((code) => (
                  <tr key={code._id} className="hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <code className="text-copper font-mono text-lg">
                          {code.code}
                        </code>
                        <button
                          onClick={() => copyToClipboard(code.code)}
                          className="text-gray-400 hover:text-white transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedCode === code.code ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {code.usedBy ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-gray-300">
                          Used
                        </span>
                      ) : isExpired(code.expiresAt) ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-900 text-red-300">
                          Expired
                        </span>
                      ) : code.isActive ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900 text-green-300">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-600 text-gray-300">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatDate(code.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-gray-400" />
                        {formatDate(code.expiresAt)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {code.usedBy ? (
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-gray-400" />
                          {code.usedBy}
                        </div>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => deleteInviteCode(code.code)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Deactivate code"
                        disabled={!code.isActive}
                      >
                        <Trash2 className={`h-4 w-4 ${!code.isActive ? 'opacity-50' : ''}`} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Total Codes</div>
          <div className="text-2xl font-bold text-white">{inviteCodes.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Active Codes</div>
          <div className="text-2xl font-bold text-green-400">
            {inviteCodes.filter(c => c.isActive && !c.usedBy && !isExpired(c.expiresAt)).length}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-sm text-gray-400 mb-1">Used Codes</div>
          <div className="text-2xl font-bold text-copper">
            {inviteCodes.filter(c => c.usedBy).length}
          </div>
        </div>
      </div>
    </div>
  );
}