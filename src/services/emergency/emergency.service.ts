import { Types } from 'mongoose';
import EmergencyAlert from '../../models/EmergencyAlert';
import User from '../../models/User';
import { IEmergencyAlert, CreateEmergencyAlertDto } from '../../types/emergency.types';
import { logger } from '../../utils/logger';
import { NotificationService } from '../notification/notification.service';
import { PoliceService } from '../integration/police.service';
import { LocationService } from '../location/location.service';
import { EventEmitter } from '../../events';
import { QueueService } from '../shared/queue.service';
import { CustomError } from '../../utils/errors';

export class EmergencyService {
  private notificationService: NotificationService;
  private policeService: PoliceService;
  private locationService: LocationService;
  private queueService: QueueService;

  constructor() {
    this.notificationService = new NotificationService();
    this.policeService = new PoliceService();
    this.locationService = new LocationService();
    this.queueService = new QueueService();
  }

  async createEmergencyAlert(alertData: CreateEmergencyAlertDto): Promise<IEmergencyAlert> {
    try {
      // Validate user exists
      const user = await User.findById(alertData.userId);
      if (!user) {
        throw new CustomError('User not found', 404);
      }

      // Get current location if not provided
      let location = alertData.location;
      if (!location) {
        const currentLocation = await this.locationService.getCurrentLocation(alertData.userId);
        location = {
          latitude: currentLocation.coordinates.coordinates[1],
          longitude: currentLocation.coordinates.coordinates[0],
          accuracy: currentLocation.accuracy,
          address: currentLocation.address,
        };
      }

      // Create emergency alert
      const alert = new EmergencyAlert({
        userId: alertData.userId,
        alertType: alertData.alertType,
        location,
        priority: this.determinePriority(alertData.alertType),
        description: alertData.description,
        additionalInfo: alertData.additionalInfo,
        metadata: alertData.metadata,
        timeline: [{
          action: 'Alert Created',
          timestamp: new Date(),
          details: `${alertData.alertType} alert triggered`,
          performedBy: 'System',
        }],
      });

      await alert.save();

      // Emit emergency event
      EventEmitter.emit('emergency:created', {
        alertId: alert._id,
        userId: alertData.userId,
        alertType: alertData.alertType,
        priority: alert.priority,
        location: alert.location,
      });

      // Schedule immediate response
      await this.scheduleEmergencyResponse(alert);

      logger.info(`Emergency alert created: ${alert._id} for user ${alertData.userId}`);
      return alert;
    } catch (error) {
      logger.error('Error creating emergency alert:', error);
      throw error;
    }
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<IEmergencyAlert> {
    try {
      const alert = await EmergencyAlert.findById(alertId);
      if (!alert) {
        throw new CustomError('Emergency alert not found', 404);
      }

      alert.status = 'acknowledged';
      alert.timeline.push({
        action: 'Alert Acknowledged',
        timestamp: new Date(),
        details: 'Emergency alert acknowledged by user',
        performedBy: acknowledgedBy,
      });

      await alert.save();

      // Notify contacts about acknowledgment
      await this.notificationService.notifyEmergencyContacts(
        alert.userId.toString(),
        `Emergency alert acknowledged by ${acknowledgedBy}`,
        'medium'
      );

      EventEmitter.emit('emergency:acknowledged', {
        alertId: alert._id,
        acknowledgedBy,
      });

      return alert;
    } catch (error) {
      logger.error('Error acknowledging emergency alert:', error);
      throw error;
    }
  }

  async resolveAlert(alertId: string, resolvedBy: string, resolution: string): Promise<IEmergencyAlert> {
    try {
      const alert = await EmergencyAlert.findById(alertId);
      if (!alert) {
        throw new CustomError('Emergency alert not found', 404);
      }

      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = new Types.ObjectId(resolvedBy);
      alert.timeline.push({
        action: 'Alert Resolved',
        timestamp: new Date(),
        details: resolution,
        performedBy: resolvedBy,
      });

      await alert.save();

      // Notify all parties about resolution
      await this.notificationService.notifyEmergencyContacts(
        alert.userId.toString(),
        `Emergency alert resolved: ${resolution}`,
        'low'
      );

      EventEmitter.emit('emergency:resolved', {
        alertId: alert._id,
        resolvedBy,
        resolution,
      });

      return alert;
    } catch (error) {
      logger.error('Error resolving emergency alert:', error);
      throw error;
    }
  }

  async cancelAlert(alertId: string, cancelledBy: string, reason: string): Promise<IEmergencyAlert> {
    try {
      const alert = await EmergencyAlert.findById(alertId);
      if (!alert) {
        throw new CustomError('Emergency alert not found', 404);
      }

      alert.status = 'cancelled';
      alert.timeline.push({
        action: 'Alert Cancelled',
        timestamp: new Date(),
        details: reason,
        performedBy: cancelledBy,
      });

      await alert.save();

      // Cancel any scheduled escalations
      await this.queueService.cancelJob(`emergency-escalation-${alertId}`);

      // Notify contacts about cancellation
      await this.notificationService.notifyEmergencyContacts(
        alert.userId.toString(),
        `False alarm - Emergency alert cancelled: ${reason}`,
        'low'
      );

      EventEmitter.emit('emergency:cancelled', {
        alertId: alert._id,
        cancelledBy,
        reason,
      });

      return alert;
    } catch (error) {
      logger.error('Error cancelling emergency alert:', error);
      throw error;
    }
  }

  async getActiveAlerts(userId: string): Promise<IEmergencyAlert[]> {
    try {
      return await EmergencyAlert.find({
        userId,
        status: { $in: ['active', 'acknowledged'] },
      }).sort({ createdAt: -1 });
    } catch (error) {
      logger.error('Error fetching active alerts:', error);
      throw error;
    }
  }

  async getAlertHistory(userId: string, limit: number = 50): Promise<IEmergencyAlert[]> {
    try {
      return await EmergencyAlert.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Error fetching alert history:', error);
      throw error;
    }
  }

  async escalateAlert(alertId: string): Promise<void> {
    try {
      const alert = await EmergencyAlert.findById(alertId).populate('userId');
      if (!alert || alert.status !== 'active') {
        return;
      }

      alert.escalationLevel += 1;
      alert.timeline.push({
        action: 'Alert Escalated',
        timestamp: new Date(),
        details: `Escalation level increased to ${alert.escalationLevel}`,
        performedBy: 'System',
      });

      switch (alert.escalationLevel) {
        case 1:
          // Notify emergency contacts
          await this.notificationService.notifyEmergencyContacts(
            alert.userId._id.toString(),
            `EMERGENCY ALERT: ${alert.description || 'Emergency situation detected'}`,
            'critical'
          );
          alert.response.contactsNotified = true;
          alert.response.contactsNotifiedAt = new Date();
          break;

        case 2:
          // Notify police
          await this.policeService.notifyPolice({
            userId: alert.userId._id.toString(),
            location: alert.location,
            alertType: alert.alertType,
            priority: alert.priority,
            userInfo: {
              name: alert.userId.fullName,
              phone: alert.userId.phone,
              medicalInfo: alert.userId.medicalInfo,
            },
          });
          alert.response.policeNotified = true;
          alert.response.policeNotifiedAt = new Date();
          break;

        case 3:
          // Notify medical services for critical alerts
          if (alert.priority === 'critical') {
            await this.notificationService.notifyMedicalServices({
              userId: alert.userId._id.toString(),
              location: alert.location,
              medicalInfo: alert.userId.medicalInfo,
              alertType: alert.alertType,
            });
            alert.response.medicalNotified = true;
            alert.response.medicalNotifiedAt = new Date();
          }
          break;
      }

      await alert.save();

      // Schedule next escalation if still active
      if (alert.escalationLevel < 3) {
        await this.queueService.scheduleJob(
          `emergency-escalation-${alertId}`,
          'emergency-escalation',
          { alertId },
          5 * 60 * 1000 // 5 minutes
        );
      }

      EventEmitter.emit('emergency:escalated', {
        alertId: alert._id,
        escalationLevel: alert.escalationLevel,
      });
    } catch (error) {
      logger.error('Error escalating emergency alert:', error);
      throw error;
    }
  }

  private determinePriority(alertType: string): 'low' | 'medium' | 'high' | 'critical' {
    const priorityMap = {
      panic: 'critical',
      auto_detect: 'high',
      check_in_missed: 'medium',
      geofence_violation: 'medium',
      manual: 'high',
    };

    return priorityMap[alertType] || 'medium';
  }

  private async scheduleEmergencyResponse(alert: IEmergencyAlert): Promise<void> {
    // Immediate response (0 seconds)
    await this.queueService.scheduleJob(
      `emergency-response-${alert._id}`,
      'emergency-response',
      { alertId: alert._id },
      0
    );

    // First escalation (5 minutes)
    await this.queueService.scheduleJob(
      `emergency-escalation-${alert._id}`,
      'emergency-escalation',
      { alertId: alert._id },
      5 * 60 * 1000
    );
  }
}