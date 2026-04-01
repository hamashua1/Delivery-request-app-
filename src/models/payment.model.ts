import mongoose, { Document, Schema } from 'mongoose';
import { PaymentStatus, PaymentMethod } from '../types/index';

export interface IPayment extends Document {
  deliveryId: mongoose.Types.ObjectId;
  customerId: mongoose.Types.ObjectId;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod;
}

const paymentSchema = new Schema<IPayment>(
  {
    deliveryId: { type: Schema.Types.ObjectId, ref: 'Delivery', required: true, unique: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    method: { type: String, enum: ['wallet', 'card'], required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PaymentModel = mongoose.model<IPayment>('Payment', paymentSchema);
