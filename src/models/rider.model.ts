import mongoose, { Document, Schema } from 'mongoose';

export interface IRider extends Document {
  userId: mongoose.Types.ObjectId;
  location: {
    type: 'Point';
    coordinates: [number, number]; // [lng, lat]
  };
  isAvailable: boolean;
  activeDeliveryId?: mongoose.Types.ObjectId | null;
}

const riderSchema = new Schema<IRider>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
    isAvailable: { type: Boolean, default: false },
    activeDeliveryId: { type: Schema.Types.ObjectId, ref: 'Delivery', default: null },
  },
  { timestamps: false }
);

riderSchema.index({ location: '2dsphere' });

export const RiderModel = mongoose.model<IRider>('Rider', riderSchema);
