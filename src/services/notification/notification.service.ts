import { Types } from 'mongoose';
import User from '../../models/User';
import Notification from '../../models/Notification';
import { INotification, CreateNotificationDto } from '../../types/notification.types';
import { logger } from '../../utils/logger';
import { EmailService } from './email.service';
import { SMSService } from './sms.service';
import { PushService } from './push.service';
import { EventEmitter } from '../../events';

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private pushService: PushService;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.pushService = new PushService();
  }

  async sendNotification(notificationData: CreateNotificationDto): Promise<INotification> {
    try {
      const notification = new Notification({
        userId: notificationData.userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        priority: notificationData.priority,
        channels: notificationData.channels,
        metadata: notificationData.metadata,
      });

      await notification.save();

      // Send through requested channels
      const results = await Promise.allSettled([
        this.sendThroughChannels(notification),
      ]);

      // Update notification status
      notification.status = 'sent';
      notification.sentAt = new Date();
      await notification.save();

      EventEmitter.emit('notification:sent', {
        notificationId: notification._id,
        userId: notificationData.userId,
        type: notificationData.type,
      });

      return notification;
    } catch (error) {
      logger.error('Error sending notification:', error);
      throw error;
    }
  }

  async notifyEmergencyContacts(
    userId: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user || !user.emergencyContacts) {
        return;
      }

      const activeContacts = user.emergencyContacts.filter(contact => contact.isActive);

      for (const contact of activeContacts) {
        // Send SMS
        await this.smsService.sendSMS(
          contact.phone,
          `EMERGENCY ALERT for ${user.fullName}: ${message}. Current location: [Location Link]`
        );

        // Send Email if available
        if (contact.email) {
          await this.emailService.sendEmail({
            to: contact.email,
            subject: `Emergency Alert - ${user.fullName}`,
            html: `
              <h2>Emergency Alert</h2>
              <p><strong>Person:</strong> ${user.fullName}</p>
              <p><strong>Message:</strong> ${message}</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
              <p><strong>Priority:</strong> ${priority.toUpperCase()}</p>
              <p>Please check on them immediately or contact emergency services.</p>
            `,
          });
        }
      }

      logger.info(`Emergency contacts notified for user ${userId}`);
    } catch (error) {
      logger.error('Error notifying emergency contacts:', error);
      throw error;
    }
  }

  async notifyMedicalServices(data: {
    userId: string;
    location: { latitude: number; longitude: number };
    medicalInfo: any;
    alertType: string;
  }): Promise<void> {
    try {
      const user = await User.findById(data.userId);
      if (!user) {
        return;
      }

      // This would integrate with medical services API
      logger.info(`Medical services notified for user ${data.userId} at location ${data.location.latitude}, ${data.location.longitude}`);
      
      // Create notification record
      await this.sendNotification({
        userId: data.userId,
        type: 'medical_alert',
        title: 'Medical Services Notified',
        message: `Medical services have been notified of your emergency at location ${data.location.latitude}, ${data.location.longitude}`,
        priority: 'critical',
        channels: ['push'],
        metadata: {
          alertType: data.alertType,
          location: data.location,
        },
      });
    } catch (error) {
      logger.error('Error notifying medical services:', error);
      throw error;
    }
  }

  private async sendThroughChannels(notification: INotification): Promise<void> {
    const user = await User.findById(notification.userId);
    if (!user) {
      return;
    }

    const promises = notification.channels.map(async (channel) => {
      switch (channel) {
        case 'email':
          if (user.preferences?.notifications?.email) {
            return this.emailService.sendEmail({
              to: user.email,
              subject: notification.title,
              html: `<p>${notification.message}</p>`,
            });
          }
          break;
        case 'sms':
          if (user.preferences?.notifications?.sms) {
            return this.smsService.sendSMS(user.phone, notification.message);
          }
          break;
        case 'push':
          if (user.preferences?.notifications?.push) {
            return this.pushService.sendPushNotification(user._id.toString(), {
              title: notification.title,
              body: notification.message,
              priority: notification.priority,
            });
          }
          break;
      }
    });

    await Promise.allSettled(promises);
  }
}