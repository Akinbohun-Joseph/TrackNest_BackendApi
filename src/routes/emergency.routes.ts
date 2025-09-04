import { Router } from 'express';
import { EmergencyController } from '../controllers/emergency.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { emergencyValidator } from '../validators/emergency.validator';

const router = Router();
const emergencyController = new EmergencyController();

// All emergency routes require authentication
router.use(authMiddleware);

// Emergency alert routes
router.post('/trigger', validateRequest(emergencyValidator.triggerEmergency), emergencyController.triggerEmergency);
router.patch('/:alertId/acknowledge', emergencyController.acknowledgeAlert);
router.patch('/:alertId/cancel', validateRequest(emergencyValidator.cancelAlert), emergencyController.cancelAlert);
router.get('/active', emergencyController.getActiveAlerts);
router.get('/history', emergencyController.getAlertHistory);

export default router;