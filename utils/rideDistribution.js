// Utility functions for calculating distances between coordinates
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const toRad = (value) => {
  return (value * Math.PI) / 180;
};

// Driver class to store driver information
class Driver {
  constructor(id, location, rideCount = 0, lastRideTime = null, isOnline = true) {
    this.id = id;
    this.location = location;
    this.rideCount = rideCount;
    this.lastRideTime = lastRideTime;
    this.isOnline = isOnline;
  }
}

// Main distribution algorithm
const distributeRideRequest = (rideRequest, availableDrivers) => {
  if (!availableDrivers || availableDrivers.length === 0) {
    console.log("No available drivers");
    return null;
  }

  // Filter only online drivers
  const onlineDrivers = availableDrivers.filter(driver => driver.isOnline);
  
  if (onlineDrivers.length === 0) {
    console.log("No online drivers");
    return null;
  }

  // If there are only a few drivers online (5 or less), use round-robin distribution
  if (onlineDrivers.length <= 5) {
    console.log("Using round-robin distribution for", onlineDrivers.length, "drivers");
    // Sort drivers by last ride time (oldest first)
    const sortedDrivers = [...onlineDrivers].sort((a, b) => {
      if (!a.lastRideTime) return -1;
      if (!b.lastRideTime) return 1;
      return new Date(a.lastRideTime) - new Date(b.lastRideTime);
    });
    
    // Return the driver who hasn't had a ride for the longest time
    return sortedDrivers[0];
  }

  // For more than 5 drivers, use the scoring system
  console.log("Using scoring system for", onlineDrivers.length, "drivers");
  const driverScores = onlineDrivers.map(driver => {
    try {
      // Calculate distance score (closer is better)
      const distance = calculateDistance(
        rideRequest.pickupLat,
        rideRequest.pickupLng,
        driver.location.latitude,
        driver.location.longitude
      );
      const distanceScore = 1 / (1 + distance); // Normalize distance score

      // Calculate fairness score based on ride count
      const maxRides = Math.max(...onlineDrivers.map(d => d.rideCount));
      const fairnessScore = 1 - (driver.rideCount / (maxRides + 1)); // Normalize fairness score

      // Calculate time score (drivers who haven't had a ride in a while get priority)
      const currentTime = new Date();
      const timeSinceLastRide = driver.lastRideTime 
        ? (currentTime - driver.lastRideTime) / (1000 * 60 * 60) // Convert to hours
        : 24; // Default to 24 hours if no last ride
      const timeScore = Math.min(timeSinceLastRide / 24, 1); // Normalize time score

      // Combine scores with weights
      const totalScore = 
        (0.4 * distanceScore) + // Distance weight: 40%
        (0.4 * fairnessScore) + // Fairness weight: 40%
        (0.2 * timeScore);     // Time weight: 20%

      return {
        driver,
        score: totalScore
      };
    } catch (error) {
      console.error("Error calculating score for driver:", driver.id, error);
      return {
        driver,
        score: 0
      };
    }
  });

  // Sort drivers by score (highest first)
  driverScores.sort((a, b) => b.score - a.score);

  // Return the best matching driver
  return driverScores[0].driver;
};

// Function to update driver statistics after a ride
const updateDriverStats = (driverId, drivers) => {
  return drivers.map(driver => {
    if (driver.id === driverId) {
      return new Driver(
        driver.id,
        driver.location,
        driver.rideCount + 1,
        new Date(),
        driver.isOnline
      );
    }
    return driver;
  });
};

module.exports = {
  distributeRideRequest,
  updateDriverStats,
  Driver
}; 