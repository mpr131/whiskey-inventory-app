'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const COMMON_DISTILLERIES = [
  'Buffalo Trace', 'Wild Turkey', 'Four Roses', 'Makers Mark', 'Jim Beam',
  'Heaven Hill', 'Barton 1792', 'Woodford Reserve', 'Glenfiddich', 'Glenlivet',
  'Macallan', 'Lagavulin', 'Ardbeg', 'Laphroaig', 'Highland Park',
  'Jameson', 'Redbreast', 'Teeling', 'Nikka', 'Suntory', 'Yamazaki'
];

export default function QuickAddPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showDistillerySuggestions, setShowDistillerySuggestions] = useState(false);
  const [distillerySuggestions, setDistillerySuggestions] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    distillery: '',
    type: 'Bourbon',
    proof: '',
    size: '750ml',
    purchasePrice: '',
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  useEffect(() => {
    if (formData.distillery) {
      const filtered = COMMON_DISTILLERIES.filter(d => 
        d.toLowerCase().includes(formData.distillery.toLowerCase())
      );
      setDistillerySuggestions(filtered);
    }
  }, [formData.distillery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const bottleData = {
        ...formData,
        proof: parseInt(formData.proof),
        purchasePrice: parseFloat(formData.purchasePrice),
        purchaseDate: new Date().toISOString(),
      };

      const response = await fetch('/api/bottles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bottleData),
      });

      if (response.ok) {
        // Clear form for next quick add
        setFormData({
          name: '',
          distillery: '',
          type: 'Bourbon',
          proof: '',
          size: '750ml',
          purchasePrice: '',
        });
        
        // Show success feedback
        const data = await response.json();
        alert(`✅ ${data.bottle.name} added to your collection!`);
        
        // Focus back on name field
        document.getElementById('name')?.focus();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create bottle');
      }
    } catch (error) {
      console.error('Error creating bottle:', error);
      alert('Failed to create bottle');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-copper animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 premium-gradient opacity-90"></div>
      
      <div className="relative z-10 w-full max-w-2xl">
        <div className="card-premium backdrop-blur-2xl">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gradient">Quick Add</h1>
              <p className="text-gray-400 mt-2">Add bottles quickly with minimal details</p>
            </div>
            <Link
              href="/bottles"
              className="text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bottle Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoFocus
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-premium w-full text-lg"
                  placeholder="e.g., Eagle Rare 10 Year"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Distillery <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.distillery}
                  onChange={(e) => setFormData({ ...formData, distillery: e.target.value })}
                  onFocus={() => setShowDistillerySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowDistillerySuggestions(false), 200)}
                  className="input-premium w-full"
                  placeholder="e.g., Buffalo Trace"
                />
                {showDistillerySuggestions && distillerySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 glass-dark rounded-lg max-h-48 overflow-y-auto">
                    {distillerySuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="block w-full text-left px-4 py-2 text-gray-300 hover:bg-white/10 transition-colors"
                        onClick={() => {
                          setFormData({ ...formData, distillery: suggestion });
                          setShowDistillerySuggestions(false);
                        }}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Type <span className="text-red-400">*</span>
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="input-premium w-full"
                >
                  <option value="Bourbon">Bourbon</option>
                  <option value="Scotch">Scotch</option>
                  <option value="Irish">Irish</option>
                  <option value="Rye">Rye</option>
                  <option value="Japanese">Japanese</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Proof <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.proof}
                  onChange={(e) => setFormData({ ...formData, proof: e.target.value })}
                  className="input-premium w-full"
                  placeholder="90"
                  min="0"
                  max="200"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Size
                </label>
                <select
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  className="input-premium w-full"
                >
                  <option value="750ml">750ml</option>
                  <option value="1L">1L</option>
                  <option value="375ml">375ml</option>
                  <option value="50ml">50ml</option>
                  <option value="200ml">200ml</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Price <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  required
                  value={formData.purchasePrice}
                  onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                  className="input-premium w-full"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="btn-primary flex-1"
              >
                {loading ? 'Adding...' : 'Add & Continue'}
              </button>
              <Link
                href="/bottles/add"
                className="btn-secondary"
                title="Switch to full form"
              >
                Full Form
              </Link>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-sm text-gray-500 text-center">
              💡 Tip: Use Quick Add for rapid entry during shopping. You can always add more details later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}