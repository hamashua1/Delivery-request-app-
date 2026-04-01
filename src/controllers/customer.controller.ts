import { Response } from 'express';
import { DeliveryModel } from '../models/delivery.model';
import { RiderModel } from '../models/rider.model';
import { findNearestRider } from '../services/matcher.service';
import { notifyDeliveryUpdate } from '../services/ws.service';
import { AuthRequest } from '../types/index';
import mongoose from 'mongoose';

export const requestDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { pickup, dropoff, price } = req.body;

    const isValidCoords = (c: unknown): boolean =>
      Array.isArray(c) && c.length === 2 &&
      typeof c[0] === 'number' && typeof c[1] === 'number' &&
      isFinite(c[0]) && isFinite(c[1]) &&
      c[0] >= -180 && c[0] <= 180 && c[1] >= -90 && c[1] <= 90;

    if (!pickup?.address || typeof pickup.address !== 'string' || !isValidCoords(pickup.coordinates)) {
      res.status(400).json({ message: 'Valid pickup address and coordinates [lng, lat] are required' });
      return;
    }
    if (!dropoff?.address || typeof dropoff.address !== 'string' || !isValidCoords(dropoff.coordinates)) {
      res.status(400).json({ message: 'Valid dropoff address and coordinates [lng, lat] are required' });
      return;
    }
    if (typeof price !== 'number' || price <= 0 || !isFinite(price)) {
      res.status(400).json({ message: 'Price must be a positive number' });
      return;
    }

    const customerId = req.userId as string;

    const delivery = await DeliveryModel.create({
      customerId,
      pickup,
      dropoff,
      price,
      status: 'pending',
    });

    const session = await mongoose.startSession();
    let assignedRiderId: string | null = null;
    try {
      await session.withTransaction(async () => {
        const riderId = await findNearestRider(pickup.coordinates as [number, number]);
        if (!riderId) return;

        const updated = await RiderModel.findOneAndUpdate(
          { userId: riderId, isAvailable: true, activeDeliveryId: null },
          { activeDeliveryId: delivery._id, isAvailable: false },
          { session, new: true }
        );
        if (!updated) return;

        delivery.status = 'assigned';
        delivery.riderId = new mongoose.Types.ObjectId(riderId);
        await delivery.save({ session });
        assignedRiderId = riderId;
      });
    } finally {
      session.endSession();
    }

    if (assignedRiderId) {
      notifyDeliveryUpdate(assignedRiderId, {
        type: 'DELIVERY_ASSIGNED',
        deliveryId: delivery._id,
        pickup,
        dropoff,
        price,
      });
    }

    const freshDelivery = await DeliveryModel.findById(delivery._id);
    res.status(201).json({
      message: assignedRiderId ? 'Rider assigned' : 'Looking for a rider',
      delivery: freshDelivery,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to create delivery request' });
  }
};

export const getDeliveryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid delivery ID' });
      return;
    }

    const delivery = await DeliveryModel.findOne({
      _id: id,
      customerId: req.userId as string,
    });

    if (!delivery) {
      res.status(404).json({ message: 'Delivery not found' });
      return;
    }

    res.status(200).json({ delivery });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch delivery status' });
  }
};

export const getDeliveryHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query['limit'] as string) || 10));
    const skip = (page - 1) * limit;

    const deliveries = await DeliveryModel.find({ customerId: req.userId as string })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({ deliveries, page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch delivery history' });
  }
};
