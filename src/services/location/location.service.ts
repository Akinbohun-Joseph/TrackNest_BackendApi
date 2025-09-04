import { Types } from 'mongoose';
import Location from '../../model/Location';
import {createUser} from '../../model/User';
import { ILocation, CreateLocationDto } from '../../types/location.types';
import { logger } from '../../utils/logger';
import { EventEmitter } from '../../events';
import { CacheService } from '../shared/cache.service';
import { CustomError } from '../../utils/errors';
import { calculateDistance } from '../../utils/distance';

export class LocationService {
  private cacheService: CacheService;

  constructor() {
    this.cacheService = new CacheService();
  }

  async updateLocation(locationData: CreateLocationDto): Promise<ILocation> {
    try {
      const location = new Location({
        userId: locationData.userId,
        coordinates: {
          type: 'Point',
          coordinates: [locationData.longitude, locationData.latitude],
        },
        accuracy: locationData.accuracy,
        timestamp: locationData.timestamp || new Date(),
        batteryLevel: locationData.batteryLevel,
        speed: locationData.speed,
        heading: locationData.heading,
        altitude: locationData.altitude,
        source: locationData.source,
        metadata: locationData.metadata,
      });

      // Reverse geocoding for address
      if (!locationData.address) {
        try {
          location.address = await this.reverseGeocode(
            locationData.latitude,
            locationData.longitude
          );
        } catch (error) {
          logger.warn('Reverse geocoding failed:', error);
        }
      }

      await location.save();

      // Update user's last location
      await User.findByIdAndUpdate(locationData.userId, {
        lastLocation: location._id,
      });

      // Cache current location
      await this.cacheService.set(
        `location:current:${locationData.userId}`,
        location,
        3600 // 1 hour
      );

      // Emit location update event
      EventEmitter.emit('location:updated', {
        userId: locationData.userId,
        location: {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          timestamp: location.timestamp,
        },
      });

      // Check for geofence violations
      await this.checkGeofenceViolations(locationData.userId, location);

      // Analyze movement patterns
      await this.analyzeMovementPattern(locationData.userId, location);

      return location;
    } catch (error) {
      logger.error('Error updating location:', error);
      throw error;
    }
  }

  async getCurrentLocation(userId: string): Promise<ILocation> {
    try {
      // Try cache first
      const cached = await this.cacheService.get(`location:current:${userId}`);
      if (cached) {
        return cached;
      }

      // Get from database
      const location = await Location.findOne({ userId })
        .sort({ timestamp: -1 })
        .limit(1);

      if (!location) {
        throw new CustomError('No location found for user', 404);
      }

      // Cache the result
      await this.cacheService.set(
        `location:current:${userId}`,
        location,
        3600
      );

      return location;
    } catch (error) {
      logger.error('Error getting current location:', error);
      throw error;
    }
  }

  async getLocationHistory(
    userId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<ILocation[]> {
    try {
      return await Location.find({
        userId,
        timestamp: {
          $gte: startDate,
          $lte: endDate,
        },
      })
        .sort({ timestamp: -1 })
        .limit(limit);
    } catch (error) {
      logger.error('Error getting location history:', error);
      throw error;
    }
  }

  async getNearbyUsers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
    excludeUserId?: string
  ): Promise<ILocation[]> {
    try {
      const query: any = {
        coordinates: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusKm * 1000, // Convert to meters
          },
        },
        timestamp: {
          $gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
        },
      };

      if (excludeUserId) {
        query.userId = { $ne: excludeUserId };
      }

      return await Location.find(query)
        .populate('userId', 'fullName phone')
        .limit(50);
    } catch (error) {
      logger.error('Error getting nearby users:', error);
      throw error;
    }
  }

  async shareLocation(
    userId: string,
    contactIds: string[],
    duration: number = 3600 // 1 hour in seconds
  ): Promise<{ shareId: string; expiresAt: Date }> {
    try {
      const shareId = `share_${userId}_${Date.now()}`;
      const expiresAt = new Date(Date.now() + duration * 1000);

      // Store sharing information in cache
      await this.cacheService.set(
        `location:share:${shareId}`,
        {
          userId,
          contactIds,
          expiresAt,
        },
        duration
      );

      // Notify contacts
      EventEmitter.emit('location:shared', {
        userId,
        shareId,
        contactIds,
        expiresAt,
      });

      return { shareId, expiresAt };
    } catch (error) {
      logger.error('Error sharing location:', error);
      throw error;
    }
  }

  async getSharedLocation(shareId: string): Promise<ILocation | null> {
    try {
      const shareInfo = await this.cacheService.get(`location:share:${shareId}`);
      if (!shareInfo) {
        return null;
      }

      return await this.getCurrentLocation(shareInfo.userId);
    } catch (error) {
      logger.error('Error getting shared location:', error);
      throw error;
    }
  }

  private async checkGeofenceViolations(userId: string, location: ILocation): Promise<void> {
    try {
      // Get user's geofences (would be stored in user preferences or separate model)
      const user = await User.findById(userId);
      if (!user || !user.preferences?.geofences) {
        return;
      }

      // Check each geofence
      for (const geofence of user.preferences.geofences) {
        const distance = calculateDistance(
          location.coordinates.coordinates[1], // latitude
          location.coordinates.coordinates[0], // longitude
          geofence.latitude,
          geofence.longitude
        );

        const isInside = distance <= geofence.radius;
        const shouldAlert = (geofence.type === 'safe' && !isInside) ||
                           (geofence.type === 'danger' && isInside);

        if (shouldAlert) {
          EventEmitter.emit('geofence:violation', {
            userId,
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            location: {
              latitude: location.coordinates.coordinates[1],
              longitude: location.coordinates.coordinates[0],
            },
            violationType: geofence.type,
          });
        }
      }
    } catch (error) {
      logger.error('Error checking geofence violations:', error);
    }
  }

  private async analyzeMovementPattern(userId: string, location: ILocation): Promise<void> {
    try {
      // Get recent locations for pattern analysis
      const recentLocations = await Location({
        userId,
        timestamp: {
          $gte: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
        },
      }).sort({ timestamp: -1 }).limit(10);

      if (recentLocations.length < 3) {
        return;
      }

      // Analyze for unusual patterns
      const speeds = [];
      const directions = [];

      for (let i = 1; i < recentLocations.length; i++) {
        const prev = recentLocations[i];
        const curr = recentLocations[i - 1];

        const distance = calculateDistance(
          prev.coordinates.coordinates[1],
          prev.coordinates.coordinates[0],
          curr.coordinates.coordinates[1],
          curr.coordinates.coordinates[0]
        );

        const timeDiff = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 1000;
        const speed = distance / timeDiff; // km/s

        speeds.push(speed);
      }

      // Detect unusual speed patterns
      const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      const maxSpeed = Math.max(...speeds);

      // Alert if speed is unusually high (potential vehicle kidnapping)
      if (maxSpeed > 0.03 && avgSpeed > 0.02) { // ~100+ km/h
        EventEmitter.emit('movement:unusual', {
          userId,
          type: 'high_speed',
          details: {
            averageSpeed: avgSpeed,
            maxSpeed: maxSpeed,
            location: {
              latitude: location.coordinates.coordinates[1],
              longitude: location.coordinates.coordinates[0],
            },
          },
        });
      }

      // Detect if user is moving in erratic patterns
      const speedVariation = Math.max(...speeds) - Math.min(...speeds);
      if (speedVariation > 0.015) { // High speed variation
        EventEmitter.emit('movement:unusual', {
          userId,
          type: 'erratic_movement',
          details: {
            speedVariation,
            location: {
              latitude: location.coordinates.coordinates[1],
              longitude: location.coordinates.coordinates[0],
            },
          },
        });
      }
    } catch (error) {
      logger.error('Error analyzing movement pattern:', error);
    }
  }

  private async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    // Implementation would use Google Maps Geocoding API
    // This is a placeholder
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
  }
}
export default new LocationService();