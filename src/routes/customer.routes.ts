import { Router } from 'express';
import { requestDelivery, getDeliveryStatus, getDeliveryHistory } from '../controllers/customer.controller';
import { authenticate, requireRole } from '../middleware/auth';
import { deliveryRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authenticate, requireRole('customer'));

router.post('/delivery', deliveryRateLimiter, requestDelivery);
router.get('/delivery/history', getDeliveryHistory);
router.get('/delivery/:id', getDeliveryStatus);

export default router;
