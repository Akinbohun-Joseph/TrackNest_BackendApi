import { Request, Response } from 'express';
import { EmergencyService } from '../services/emergency/emergency.service';
import { CreateEmergencyAlertDto } from '../types/emergency.types';
import { logger } from '../utils/logger';
import { catchAsync } from '../utils/catchAsync';

export class EmergencyController {
  private emergencyService: EmergencyService;

  constructor() {
    this.emergencyService = new EmergencyService();
  }

  triggerEmergency = catchAsync(async (req: Request, res: Response) => {
    const alertData: CreateEmergencyAlertDto = {
      userId: req.user.id,
      alertType: req.body.alertType || 'panic',
      location: req.body.location,
      description: req.body.description,
      additionalInfo: {
        batteryLevel: req.body.batteryLevel,
        networkStrength: req.body.networkStrength,
        deviceInfo: req.body.deviceInfo,
        userInput: req.body.userInput,
      },
      metadata: {
        deviceId: req.body.deviceId,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        source: 'mobile_app',
      },
    };

    const alert = await this.emergencyService.createEmergencyAlert(alertData);

    res.status(201).json({
      success: true,
      message: 'Emergency alert created successfully',
      data: {
        alertId: alert._id,
        status: alert.status,
        createdAt: alert.createdAt,
      },
    });
  });

  acknowledgeAlert = catchAsync(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    const alert = await this.emergencyService.acknowledgeAlert(alertId, req.user.id);

    res.json({
      success: true,
      message: 'Alert acknowledged successfully',
      data: alert,
    });
  });

  cancelAlert = catchAsync(async (req: Request, res: Response) => {
    const { alertId } = req.params;
    const { reason } = req.body;
    
    const alert = await this.emergencyService.cancelAlert(alertId, req.user.id, reason);

    res.json({
      success: true,
      message: 'Alert cancelled successfully',
      data: alert,
    });
  });

  getActiveAlerts = catchAsync(async (req: Request, res: Response) => {
    const alerts = await this.emergencyService.getActiveAlerts(req.user.id);

    res.json({
      success: true,
      data: alerts,
    });
  });

  getAlertHistory = catchAsync(async (req: Request, res: Response) => {
    const { limit = 50 } = req.query;
    const alerts = await this.emergencyService.getAlertHistory(req.user.id, Number(limit));

    res.json({
      success: true,
      data: alerts,
    });
  });
}