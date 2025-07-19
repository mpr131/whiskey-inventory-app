'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';

interface MasterBottle {
  _id: string;
  name: string;
  brand: string;
  distillery: string;
  region?: string;
  category: string;
  type: string;
  age?: number;
  proof?: number;
  msrp?: number;
  description?: string;
  isStorePick: boolean;
  storePickDetails?: {
    store: string;
    pickDate?: string;
    barrel?: string;
  };
}

interface UserBottle {
  _id: string;
  userId: string;
  masterBottleId: MasterBottle;
  purchaseDate?: string;
  purchasePrice?: number;
  marketValue?: number;
  myValue?: number;
  quantity: number;
  location?: {
    area: string;
    bin: string;
  };
  notes?: string;
  personalNotes?: string;
  purchaseNote?: string;
  deliveryDate?: string;
  barcode?: string;
  cellarTrackerId?: string;
  status: 'unopened' | 'opened' | 'finished';
  photos: string[];
  pours: Array<{
    date: string;
    amount: number;
    rating?: number;
    notes?: string;
  }>;
  fillLevel: number;
  openDate?: string;
  createdAt: string;
  updatedAt: string;
}

export default function PrintLabelPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const bottleId = params.id as string;
  
  const [bottle, setBottle] = useState<UserBottle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/auth/signin');
      return;
    }

    fetchBottleDetails();
  }, [session, status, router, bottleId]);

  const fetchBottleDetails = async () => {
    try {
      const response = await fetch(`/api/bottles/${bottleId}`);
      if (response.ok) {
        const data = await response.json();
        setBottle(data);
      } else if (response.status === 404) {
        toast.error('Bottle not found');
        router.push('/bottles');
      } else {
        toast.error('Failed to load bottle details');
      }
    } catch (error) {
      console.error('Failed to fetch bottle details:', error);
      toast.error('Failed to load bottle details');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generateQRCode = (text: string) => {
    // Simple QR code generation - in a real app, you'd use a proper QR library
    return `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(text)}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (value?: number) => {
    if (!value) return '';
    return `$${value.toLocaleString()}`;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  if (!bottle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Bottle not found</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      {/* Header - Hidden in print */}
      <div className="flex items-center justify-between mb-8 print:hidden">
        <div className="flex items-center space-x-4">
          <Link 
            href={`/bottles/${bottleId}`}
            className="flex items-center space-x-2 text-gray-400 hover:text-copper transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Bottle</span>
          </Link>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-4 py-2 bg-copper/20 hover:bg-copper/30 text-copper rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Label</span>
          </button>
        </div>
      </div>

      {/* Print Preview */}
      <div className="bg-white text-black print:bg-white print:shadow-none card-premium">
        <div className="p-6">
          {/* Large Label Format */}
          <div className="border-2 border-gray-300 p-4 mb-6 print:border-black print:mb-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-2xl font-bold mb-2 print:text-xl">
                  {bottle.masterBottleId.name}
                </h1>
                <div className="text-lg mb-2 print:text-base">
                  {bottle.masterBottleId.distillery}
                </div>
                <div className="text-sm text-gray-600 space-y-1 print:text-xs">
                  <div>Category: {bottle.masterBottleId.category}</div>
                  {bottle.masterBottleId.age && (
                    <div>Age: {bottle.masterBottleId.age} Years</div>
                  )}
                  {bottle.masterBottleId.proof && (
                    <div>Proof: {bottle.masterBottleId.proof}°</div>
                  )}
                  {bottle.location && (
                    <div className="font-medium">
                      Location: {bottle.location.area}
                      {bottle.location.bin && ` - ${bottle.location.bin}`}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-2">
                {/* QR Code */}
                <div className="border border-gray-300 p-1">
                  <img 
                    src={generateQRCode(`${window.location.origin}/bottles/${bottle._id}`)}
                    alt="QR Code"
                    className="w-16 h-16 print:w-12 print:h-12"
                  />
                </div>
                
                {/* Barcode */}
                <div className="text-xs font-mono text-center print:text-[10px]">
                  {bottle.barcode || `WV${bottle._id.slice(-8)}`}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-300 print:border-t-black">
              <div className="grid grid-cols-2 gap-4 text-sm print:text-xs">
                <div>
                  <div className="font-medium">Purchase Info:</div>
                  <div>{formatDate(bottle.purchaseDate)}</div>
                  <div>{formatCurrency(bottle.purchasePrice)}</div>
                  {bottle.purchaseNote && bottle.purchaseNote.includes('Purchased from:') && (
                    <div className="text-xs">
                      {bottle.purchaseNote.match(/Purchased from: ([^.]+)/)?.[1]}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium">Status:</div>
                  <div className="capitalize">{bottle.status}</div>
                  {bottle.status === 'opened' && (
                    <div>Fill: {bottle.fillLevel}%</div>
                  )}
                  {bottle.openDate && (
                    <div>Opened: {formatDate(bottle.openDate)}</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Small Label Format */}
          <div className="border-2 border-gray-300 p-2 print:border-black print:page-break-before">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-bold text-sm print:text-xs">
                  {bottle.masterBottleId.name}
                </div>
                <div className="text-xs print:text-[10px]">
                  {bottle.masterBottleId.distillery}
                </div>
                <div className="text-xs print:text-[10px]">
                  {bottle.location?.area}{bottle.location?.bin && ` - ${bottle.location.bin}`}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <img 
                  src={generateQRCode(`${window.location.origin}/bottles/${bottle._id}`)}
                  alt="QR Code"
                  className="w-8 h-8 print:w-6 print:h-6"
                />
                <div className="text-[10px] font-mono">
                  {bottle.barcode || `WV${bottle._id.slice(-8)}`}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Instructions - Hidden in print */}
      <div className="mt-8 card-premium print:hidden">
        <h2 className="text-xl font-semibold text-white mb-4">Printing Instructions</h2>
        <div className="space-y-2 text-gray-300">
          <p>• Use the Print Label button above to print this label</p>
          <p>• Large label format (4&quot; x 3&quot;) is suitable for bottle fronts</p>
          <p>• Small label format (2&quot; x 1&quot;) is suitable for bottle necks or caps</p>
          <p>• The QR code links directly to this bottle&apos;s detail page</p>
          <p>• The barcode is unique to this specific bottle</p>
        </div>
      </div>
      
      {/* Print Styles */}
      <style jsx>{`
        @media print {
          @page {
            size: auto;
            margin: 0.5in;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:text-xl {
            font-size: 1.25rem !important;
          }
          
          .print\\:text-base {
            font-size: 1rem !important;
          }
          
          .print\\:text-xs {
            font-size: 0.75rem !important;
          }
          
          .print\\:text-\\[10px\\] {
            font-size: 10px !important;
          }
          
          .print\\:w-12 {
            width: 3rem !important;
          }
          
          .print\\:h-12 {
            height: 3rem !important;
          }
          
          .print\\:w-6 {
            width: 1.5rem !important;
          }
          
          .print\\:h-6 {
            height: 1.5rem !important;
          }
          
          .print\\:border-black {
            border-color: black !important;
          }
          
          .print\\:border-t-black {
            border-top-color: black !important;
          }
          
          .print\\:page-break-before {
            page-break-before: always;
          }
          
          .print\\:mb-0 {
            margin-bottom: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}