import { Response } from 'express';
import { RiderModel } from '../models/rider.model';
import { DeliveryModel } from '../models/delivery.model';
import { notifyDeliveryUpdate, broadcastLocationUpdate } from '../services/ws.service';
import { AuthRequest } from '../types/index';
import mongoose from 'mongoose';

export const updateLocation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { coordinates } = req.body;

    if (
      !Array.isArray(coordinates) || coordinates.length !== 2 ||
      typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number' ||
      !isFinite(coordinates[0]) || !isFinite(coordinates[1]) ||
      coordinates[0] < -180 || coordinates[0] > 180 ||
      coordinates[1] < -90 || coordinates[1] > 90
    ) {
      res.status(400).json({ message: 'coordinates must be [lng, lat] with valid range' });
      return;
    }

    const rider = await RiderModel.findOneAndUpdate(
      { userId: req.userId as string },
      { location: { type: 'Point', coordinates } },
      { new: true, upsert: true }
    );

    if (rider?.activeDeliveryId) {
      const delivery = await DeliveryModel.findOne({
        _id: rider.activeDeliveryId,
        riderId: req.userId as string,
      }).select('customerId');
      if (delivery) {
        broadcastLocationUpdate(
          (delivery.customerId as unknown as mongoose.Types.ObjectId).toString(),
          coordinates as [number, number]
        );
      }
    }

    res.status(200).json({ message: 'Location updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update location' });
  }
};

export const setAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isAvailable } = req.body;

    if (typeof isAvailable !== 'boolean') {
      res.status(400).json({ message: 'isAvailable must be a boolean' });
      return;
    }

    await RiderModel.findOneAndUpdate(
      { userId: req.userId as string },
      { isAvailable },
      { upsert: true }
    );

    res.status(200).json({ message: `You are now ${isAvailable ? 'available' : 'unavailable'}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update availability' });
  }
};

export const acceptDelivery = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid delivery ID' });
      return;
    }

    const delivery = await DeliveryModel.findOne({ _id: id, status: 'assigned', riderId: req.userId as string });
    if (!delivery) {
      res.status(404).json({ message: 'Delivery not found or not assigned to you' });
      return;
    }

    delivery.status = 'in_progress';
    await delivery.save();

    notifyDeliveryUpdate((delivery.customerId as unknown as mongoose.Types.ObjectId).toString(), {
      type: 'DELIVERY_STATUS',
      deliveryId: delivery._id,
      status: 'in_progress',
    });

    res.status(200).json({ message: 'Delivery accepted', delivery });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to accept delivery' });
  }
};

export const updateDeliveryStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = req.params['id'] as string;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ message: 'Invalid delivery ID' });
      return;
    }

    const allowed = ['in_progress', 'completed', 'cancelled'];
    if (!status || !allowed.includes(status)) {
      res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
      return;
    }

    const delivery = await DeliveryModel.findOne({ _id: id, riderId: req.userId as string });
    if (!delivery) {
      res.status(404).json({ message: 'Delivery not found or not assigned to you' });
      return;
    }

    delivery.status = status;
    await delivery.save();

    if (status === 'completed' || status === 'cancelled') {
      await RiderModel.findOneAndUpdate(
        { userId: req.userId as string },
        { activeDeliveryId: null, isAvailable: true }
      );
    }

    notifyDeliveryUpdate((delivery.customerId as unknown as mongoose.Types.ObjectId).toString(), {
      type: 'DELIVERY_STATUS',
      deliveryId: delivery._id,
      status,
    });

    res.status(200).json({ message: `Delivery marked as ${status}`, delivery });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update delivery status' });
  }
};
