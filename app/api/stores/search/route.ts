import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserStore from '@/models/UserStore';
import MasterStore from '@/models/MasterStore';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (query.length < 1) {
      return NextResponse.json({ stores: [] });
    }

    // Find user stores that match the query (case-insensitive)
    const userStores = await UserStore.find({
      userId: session.user.id,
    }).populate('masterStoreId');

    // Extract unique store names from populated master stores
    const storeNames = new Set<string>();
    
    userStores.forEach(store => {
      const masterStore = store.masterStoreId as any;
      if (masterStore?.name) {
        const storeName = masterStore.name;
        // Case-insensitive matching
        if (storeName.toLowerCase().includes(query.toLowerCase())) {
          storeNames.add(storeName);
        }
      }
    });

    // Also search MasterStores directly for potential matches
    const masterStores = await MasterStore.find({
      name: { $regex: query, $options: 'i' }
    }).limit(limit);

    masterStores.forEach(store => {
      storeNames.add(store.name);
    });

    // Convert to array and sort
    const stores = Array.from(storeNames)
      .sort((a, b) => {
        // Prioritize exact matches (case-insensitive)
        const aExact = a.toLowerCase() === query.toLowerCase();
        const bExact = b.toLowerCase() === query.toLowerCase();
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Then prioritize starts with
        const aStarts = a.toLowerCase().startsWith(query.toLowerCase());
        const bStarts = b.toLowerCase().startsWith(query.toLowerCase());
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Finally alphabetical
        return a.localeCompare(b);
      })
      .slice(0, limit);

    return NextResponse.json({ stores });
  } catch (error) {
    console.error('Error searching stores:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}