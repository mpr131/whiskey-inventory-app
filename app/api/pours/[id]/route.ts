import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import dbConnect from '@/lib/mongodb';
import Pour from '@/models/Pour';
import UserBottle from '@/models/UserBottle';
import PourSession from '@/models/PourSession';
import mongoose from 'mongoose';

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

    // Find the pour and verify ownership
    const pour = await Pour.findById(params.id);

    if (!pour) {
      return NextResponse.json({ error: 'Pour not found' }, { status: 404 });
    }

    if (pour.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Store pour data before deletion for updating related records
    const pourAmount = pour.amount;
    const pourRating = pour.rating;
    const pourSessionId = pour.sessionId;
    const userBottleId = pour.userBottleId;
    const pourCost = pour.costPerPour;

    // Delete the pour
    await Pour.findByIdAndDelete(params.id);

    // Update the user bottle's fill level and statistics
    if (userBottleId) {
      const userBottle = await UserBottle.findById(userBottleId);

      if (userBottle) {
        // Restore the fill level (add back the poured amount)
        const bottleSize = 25.36; // 750ml in ounces
        const pourPercentage = (pourAmount / bottleSize) * 100;
        const newFillLevel = Math.min(100, (userBottle.fillLevel || 0) + pourPercentage);

        // Update fill level
        if (typeof userBottle.adjustFillLevel === 'function') {
          userBottle.adjustFillLevel(newFillLevel, 'manual', `Deleted pour of ${pourAmount}oz`);
        } else {
          userBottle.fillLevel = newFillLevel;
        }

        // Remove from legacy pours array if it exists
        if (userBottle.pours && Array.isArray(userBottle.pours)) {
          // Find and remove the pour from the array by matching date and amount
          const pourIndex = userBottle.pours.findIndex((p: any) =>
            p.date.getTime() === pour.date.getTime() &&
            p.amount === pourAmount
          );

          if (pourIndex > -1) {
            userBottle.pours.splice(pourIndex, 1);
          }
        }

        // If bottle was finished but now has content, reopen it
        if (userBottle.status === 'finished' && newFillLevel > 0) {
          userBottle.status = 'opened';
        }

        await userBottle.save();

        // Update bottle statistics
        if (typeof userBottle.updatePourStats === 'function') {
          await userBottle.updatePourStats();
        }
      }
    }

    // Update pour session statistics
    if (pourSessionId) {
      const pourSession = await PourSession.findById(pourSessionId);

      if (pourSession) {
        // Recalculate session statistics
        const remainingPours = await Pour.find({ sessionId: pourSessionId });

        pourSession.totalPours = remainingPours.length;
        pourSession.totalAmount = remainingPours.reduce((sum, p) => sum + p.amount, 0);

        // Recalculate average rating
        const ratedPours = remainingPours.filter(p => p.rating);
        if (ratedPours.length > 0) {
          const totalRating = ratedPours.reduce((sum, p) => sum + (p.rating || 0), 0);
          pourSession.averageRating = parseFloat((totalRating / ratedPours.length).toFixed(1));
        } else {
          pourSession.averageRating = undefined;
        }

        // Recalculate total cost
        const poursWithCost = remainingPours.filter(p => p.costPerPour);
        if (poursWithCost.length > 0) {
          pourSession.totalCost = poursWithCost.reduce((sum, p) => sum + (p.costPerPour || 0), 0);
        } else {
          pourSession.totalCost = undefined;
        }

        // If session has no more pours, optionally delete it
        if (pourSession.totalPours === 0) {
          // For now, we'll keep empty sessions for history
          // Uncomment the next line to delete empty sessions:
          // await PourSession.findByIdAndDelete(pourSessionId);
        } else {
          await pourSession.save();
        }
      }
    }

    return NextResponse.json({
      message: 'Pour deleted successfully',
      deletedPourId: params.id
    });

  } catch (error) {
    console.error('Error deleting pour:', error);
    return NextResponse.json(
      { error: 'Failed to delete pour' },
      { status: 500 }
    );
  }
}