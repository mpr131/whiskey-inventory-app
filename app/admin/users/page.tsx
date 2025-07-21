'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Search, 
  Calendar, 
  Wine, 
  Shield, 
  Edit, 
  Trash2, 
  Eye, 
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Mail,
  Check,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface User {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLogin?: string;
  isAdmin: boolean;
  bottleCount?: number;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  totalBottles: number;
  newUsersThisMonth: number;
}

export default function ManageUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [adminFilter, setAdminFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastLogin' | 'bottleCount'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [processingUser, setProcessingUser] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const USERS_PER_PAGE = 10;

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user?.isAdmin) {
      router.push('/');
      toast.error('Admin access required');
    }
  }, [session, status, router]);

  useEffect(() => {
    fetchUsers();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchQuery, adminFilter, sortBy, sortOrder]);

  const fetchUsers = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: USERS_PER_PAGE.toString(),
        search: searchQuery,
        adminFilter,
        sortBy,
        sortOrder,
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) throw new Error('Failed to fetch users');
      
      const data = await response.json();
      setUsers(data.users || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/users/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    setProcessingUser(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentStatus }),
      });

      if (!response.ok) throw new Error('Failed to update admin status');
      
      toast.success(`Admin privileges ${!currentStatus ? 'granted' : 'revoked'}`);
      fetchUsers();
    } catch (error) {
      console.error('Error toggling admin:', error);
      toast.error('Failed to update admin status');
    } finally {
      setProcessingUser(null);
    }
  };

  const resetPassword = async (userId: string, email: string) => {
    setProcessingUser(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
        method: 'POST',
      });

      if (!response.ok) throw new Error('Failed to reset password');
      
      toast.success(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Failed to send reset email');
    } finally {
      setProcessingUser(null);
    }
  };

  const deleteUser = async (userId: string) => {
    if (!deleteConfirm) return;
    
    setProcessingUser(userId);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete user');
      
      toast.success('User deleted successfully');
      setDeleteConfirm(null);
      fetchUsers();
      fetchStats();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    } finally {
      setProcessingUser(null);
    }
  };

  const exportUsers = async () => {
    try {
      const response = await fetch('/api/admin/users/export');
      if (!response.ok) throw new Error('Failed to export users');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('User list exported');
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('Failed to export users');
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatLastLogin = (date?: string) => {
    if (!date) return 'Never';
    const days = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 30) return `${days} days ago`;
    return formatDate(date);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-copper" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-6">Manage Users</h1>
        
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="card-premium p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Users</p>
                  <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
                </div>
                <Users className="w-8 h-8 text-copper" />
              </div>
            </div>
            
            <div className="card-premium p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Active Users</p>
                  <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
                  <p className="text-xs text-gray-500">Last 30 days</p>
                </div>
                <Calendar className="w-8 h-8 text-copper" />
              </div>
            </div>
            
            <div className="card-premium p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">Total Bottles</p>
                  <p className="text-2xl font-bold text-white">{stats.totalBottles}</p>
                </div>
                <Wine className="w-8 h-8 text-copper" />
              </div>
            </div>
            
            <div className="card-premium p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400">New This Month</p>
                  <p className="text-2xl font-bold text-white">{stats.newUsersThisMonth}</p>
                </div>
                <Users className="w-8 h-8 text-copper" />
              </div>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="card-premium p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by username or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all"
                />
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {/* Admin Filter Buttons */}
              <div className="flex gap-1 bg-gray-800/50 p-1 rounded-lg">
                <button
                  onClick={() => {
                    setAdminFilter('all');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    adminFilter === 'all'
                      ? 'bg-copper text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  All Users
                </button>
                <button
                  onClick={() => {
                    setAdminFilter('admin');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    adminFilter === 'admin'
                      ? 'bg-copper text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  Admins
                </button>
                <button
                  onClick={() => {
                    setAdminFilter('user');
                    setCurrentPage(1);
                  }}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    adminFilter === 'user'
                      ? 'bg-copper text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  Regular
                </button>
              </div>
              
              {/* Sort Dropdown */}
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-');
                  setSortBy(field as any);
                  setSortOrder(order as any);
                  setCurrentPage(1);
                }}
                className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-copper/50 focus:border-copper transition-all cursor-pointer"
              >
                <option value="createdAt-desc" className="bg-gray-800 text-white">Newest First</option>
                <option value="createdAt-asc" className="bg-gray-800 text-white">Oldest First</option>
                <option value="lastLogin-desc" className="bg-gray-800 text-white">Recently Active</option>
                <option value="lastLogin-asc" className="bg-gray-800 text-white">Least Active</option>
                <option value="bottleCount-desc" className="bg-gray-800 text-white">Most Bottles</option>
                <option value="bottleCount-asc" className="bg-gray-800 text-white">Least Bottles</option>
              </select>
              
              {/* Export Button */}
              <button
                onClick={exportUsers}
                className="px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-all flex items-center gap-2"
                title="Export to CSV"
              >
                <Download className="w-5 h-5" />
                <span className="hidden sm:inline">Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-800/30 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Join Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bottles
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Admin
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-white">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                      {formatLastLogin(user.lastLogin)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-white">
                      {user.bottleCount || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      {user.isAdmin ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-copper/20 text-copper">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {user._id !== session?.user?.id && (
                          <>
                            <button
                              onClick={() => toggleAdmin(user._id, user.isAdmin)}
                              disabled={processingUser === user._id}
                              className="p-1 text-gray-400 hover:text-copper transition-colors"
                              title={user.isAdmin ? 'Remove admin' : 'Make admin'}
                            >
                              {processingUser === user._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </button>
                            
                            <button
                              onClick={() => resetPassword(user._id, user.email)}
                              disabled={processingUser === user._id}
                              className="p-1 text-gray-400 hover:text-copper transition-colors"
                              title="Reset password"
                            >
                              <Mail className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        
                        <Link
                          href={`/bottles?userId=${user._id}`}
                          className="p-1 text-gray-400 hover:text-copper transition-colors"
                          title="View bottles"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        
                        {user._id !== session?.user?.id && (
                          <>
                            {deleteConfirm === user._id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteUser(user._id)}
                                  disabled={processingUser === user._id}
                                  className="p-1 text-red-400 hover:text-red-300 transition-colors"
                                  title="Confirm delete"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="p-1 text-gray-400 hover:text-white transition-colors"
                                  title="Cancel"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(user._id)}
                                className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                                title="Delete user"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-3 bg-gray-800/30 border-t border-gray-700 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}