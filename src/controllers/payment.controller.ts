import { Response } from 'express';
import { PaymentModel } from '../models/payment.model';
import { DeliveryModel } from '../models/delivery.model';
import { AuthRequest } from '../types/index';
import mongoose from 'mongoose';

export const processPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { deliveryId, method } = req.body;

    if (!deliveryId || !mongoose.Types.ObjectId.isValid(deliveryId)) {
      res.status(400).json({ message: 'Valid delivery ID is required' });
      return;
    }
    if (!method || !['wallet', 'card'].includes(method)) {
      res.status(400).json({ message: 'Method must be wallet or card' });
      return;
    }

    const delivery = await DeliveryModel.findOne({
      _id: deliveryId,
      customerId: req.userId as string,
      status: 'completed',
    });

    if (!delivery) {
      res.status(404).json({ message: 'Completed delivery not found' });
      return;
    }

    const existing = await PaymentModel.findOne({ deliveryId });
    if (existing) {
      res.status(409).json({ message: 'Payment already processed for this delivery' });
      return;
    }

    const payment = await PaymentModel.create({
      deliveryId,
      customerId: req.userId as string,
      amount: delivery.price,
      status: 'paid',
      method,
    });

    res.status(201).json({ message: 'Payment processed successfully', payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Payment processing failed' });
  }
};

export const getPaymentStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const deliveryId = req.params['deliveryId'] as string;

    if (!mongoose.Types.ObjectId.isValid(deliveryId)) {
      res.status(400).json({ message: 'Invalid delivery ID' });
      return;
    }

    const payment = await PaymentModel.findOne({
      deliveryId,
      customerId: req.userId as string,
    });

    if (!payment) {
      res.status(404).json({ message: 'Payment not found' });
      return;
    }

    res.status(200).json({ payment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch payment status' });
  }
};
