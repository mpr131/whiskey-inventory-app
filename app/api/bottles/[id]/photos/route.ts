import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import UserBottle from '@/models/UserBottle';
import MasterBottle from '@/models/MasterBottle';
import UserStore from '@/models/UserStore';
import MasterStore from '@/models/MasterStore';
import cloudinary from '@/lib/cloudinary';
import { getPublicIdFromUrl } from '@/lib/cloudinary';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    // Check bottle ownership
    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `whiskey-inventory/${session.user.id}`,
          resource_type: 'image',
          transformation: [
            { quality: 'auto', fetch_format: 'auto' },
            { width: 1200, height: 1200, crop: 'limit' }
          ],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(buffer);
    });

    // Add photo URL to bottle
    bottle.photos.push((result as any).secure_url);
    await bottle.save();

    // Return updated bottle with populated data
    const updatedBottle = await UserBottle.findById(bottle._id)
      .populate('masterBottleId')
      .populate({
        path: 'storeId',
        populate: {
          path: 'masterStoreId',
          model: 'MasterStore'
        }
      });

    return NextResponse.json({
      success: true,
      photo: (result as any).secure_url,
      bottle: updatedBottle,
    });

  } catch (error: any) {
    console.error('Error uploading photo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload photo' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();
    
    const { photoUrl } = await req.json();
    
    if (!photoUrl) {
      return NextResponse.json({ error: 'No photo URL provided' }, { status: 400 });
    }

    // Check bottle ownership
    const bottle = await UserBottle.findOne({
      _id: params.id,
      userId: session.user.id,
    });

    if (!bottle) {
      return NextResponse.json({ error: 'Bottle not found' }, { status: 404 });
    }

    // Remove photo from bottle
    bottle.photos = bottle.photos.filter(photo => photo !== photoUrl);
    await bottle.save();

    // Delete from Cloudinary
    try {
      const publicId = getPublicIdFromUrl(photoUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue even if Cloudinary deletion fails
    }

    // Return updated bottle
    const updatedBottle = await UserBottle.findById(bottle._id)
      .populate('masterBottleId')
      .populate({
        path: 'storeId',
        populate: {
          path: 'masterStoreId',
          model: 'MasterStore'
        }
      });

    return NextResponse.json({
      success: true,
      bottle: updatedBottle,
    });

  } catch (error: any) {
    console.error('Error deleting photo:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete photo' },
      { status: 500 }
    );
  }
}