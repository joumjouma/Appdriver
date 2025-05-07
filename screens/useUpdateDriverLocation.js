import { useEffect } from "react";
import * as Location from "expo-location";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../config/firebase";

const useUpdateDriverLocation = () => {
  const auth = getAuth();
  
  useEffect(() => {
    let locationSubscription = null;
    let onlineStatusInterval = null;

    const startLocationUpdates = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('Location permission not granted');
          return;
        }

        if (!auth.currentUser) {
          console.error('No authenticated user found');
          return;
        }

        const driverRef = doc(db, "Drivers", auth.currentUser.uid);
        
        // Get current driver status
        const driverDoc = await getDoc(driverRef);
        if (!driverDoc.exists()) {
          console.error('Driver document not found');
          return;
        }

        const driverData = driverDoc.data();
        const isDriverOnline = driverData.isOnline;

        // Initial location update
        const currentLocation = await Location.getCurrentPositionAsync({});
        await updateDoc(driverRef, {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          lastLocationUpdate: new Date().toISOString(),
          isOnline: isDriverOnline // Maintain existing online status
        });

        // Set up location subscription
        locationSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10,
          },
          async (location) => {
            try {
              const { latitude, longitude } = location.coords;
              const driverRef = doc(db, "Drivers", auth.currentUser.uid);
              const driverDoc = await getDoc(driverRef);
              
              if (driverDoc.exists()) {
                const driverData = driverDoc.data();
                await updateDoc(driverRef, {
                  latitude,
                  longitude,
                  lastLocationUpdate: new Date().toISOString(),
                  isOnline: driverData.isOnline // Maintain existing online status
                });
              }
            } catch (error) {
              console.error('Error updating location:', error);
            }
          }
        );

        // Set up periodic online status check
        onlineStatusInterval = setInterval(async () => {
          try {
            const driverRef = doc(db, "Drivers", auth.currentUser.uid);
            const driverDoc = await getDoc(driverRef);
            
            if (driverDoc.exists()) {
              const driverData = driverDoc.data();
              const lastUpdate = driverData.lastLocationUpdate;
              const now = new Date();
              const lastUpdateTime = new Date(lastUpdate);
              const timeDiff = (now - lastUpdateTime) / 1000; // in seconds

              // If no location update for more than 30 seconds and driver is marked as online
              if (timeDiff > 30 && driverData.isOnline) {
                await updateDoc(driverRef, {
                  isOnline: false,
                  lastOnlineUpdate: new Date().toISOString()
                });
              }
            }
          } catch (error) {
            console.error('Error in online status check:', error);
          }
        }, 10000); // Check every 10 seconds

      } catch (error) {
        console.error('Error in location updates:', error);
      }
    };

    startLocationUpdates();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      if (onlineStatusInterval) {
        clearInterval(onlineStatusInterval);
      }
    };
  }, []);
};

export default useUpdateDriverLocation;