import mongoose, { Document, Schema } from 'mongoose';
import { DeliveryStatus } from '../types/index';

interface LocationPoint {
  address: string;
  coordinates: [number, number]; // [lng, lat]
}

export interface IDelivery extends Document {
  customerId: mongoose.Types.ObjectId;
  riderId?: mongoose.Types.ObjectId | null;
  status: DeliveryStatus;
  pickup: LocationPoint;
  dropoff: LocationPoint;
  price: number;
}

const locationSchema = new Schema<LocationPoint>(
  {
    address: { type: String, required: true, trim: true, maxlength: 300 },
    coordinates: { type: [Number], required: true },
  },
  { _id: false }
);

const deliverySchema = new Schema<IDelivery>(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    riderId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status: {
      type: String,
      enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
      default: 'pending',
    },
    pickup: { type: locationSchema, required: true },
    dropoff: { type: locationSchema, required: true },
    price: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const DeliveryModel = mongoose.model<IDelivery>('Delivery', deliverySchema);
