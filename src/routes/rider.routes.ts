import { Router } from 'express';
import {
  updateLocation,
  setAvailability,
  acceptDelivery,
  updateDeliveryStatus,
} from '../controllers/rider.controller';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

router.use(authenticate, requireRole('rider'));

router.patch('/location', updateLocation);
router.patch('/availability', setAvailability);
router.post('/delivery/:id/accept', acceptDelivery);
router.patch('/delivery/:id/status', updateDeliveryStatus);

export default router;
