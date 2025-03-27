import { useEffect } from "react";
import * as Location from "expo-location";
import { doc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";

const useUpdateDriverLocation = () => {
  const auth = getAuth();
  
  useEffect(() => {
    let subscription;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission denied");
        return;
      }
      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
        async (location) => {
          const { latitude, longitude } = location.coords;
          // Update the driver's location in Firestore
          const driverId = auth.currentUser.uid;
          await updateDoc(doc(db, "Drivers", driverId), { latitude, longitude });
        }
      );
    })();

    return () => {
      if (subscription) {
        subscription.remove();
      }
    };
  }, []);
};

export default useUpdateDriverLocation;