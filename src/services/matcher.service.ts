import { RiderModel } from '../models/rider.model';

export const findNearestRider = async (
  coordinates: [number, number],
  maxDistanceMeters = 10000
): Promise<string | null> => {
  const rider = await RiderModel.findOne({
    isAvailable: true,
    activeDeliveryId: null,
    location: {
      $near: {
        $geometry: { type: 'Point', coordinates },
        $maxDistance: maxDistanceMeters,
      },
    },
  });

  return rider ? (rider.userId as unknown as string) : null;
};
