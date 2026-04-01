import { Router } from 'express';
import { processPayment, getPaymentStatus } from '../controllers/payment.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.post('/pay', processPayment);
router.get('/:deliveryId', getPaymentStatus);

export default router;
