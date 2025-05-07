import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  Linking,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import { Ionicons, MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  setDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase"; // Adjust to your Firebase configuration
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import useUpdateDriverLocation from "./useUpdateDriverLocation"; // Custom hook for updating location

const HomeScreenWithMap = () => {
  // -----------------------------------------------------------------
  // 1. Update driver's location in real time using custom hook
  // -----------------------------------------------------------------
  useUpdateDriverLocation();

  // -----------------------------------------------------------------
  // 2. State Variables
  // -----------------------------------------------------------------
  const [region, setRegion] = useState(null);
  const [fromLocation, setFromLocation] = useState(null);
  const [userName, setUserName] = useState("Driver");
  const [driverType, setDriverType] = useState("");
  const [driverPhoto, setDriverPhoto] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState(0.0);
  const [currentRideRequest, setCurrentRideRequest] = useState(null);
  const [pickupAddress, setPickupAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const [lastReset, setLastReset] = useState(Date.now());
  const [timeLeft, setTimeLeft] = useState(15);
  const [rideDistance, setRideDistance] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(null);

  // Animated value for the countdown circle
  const countdownAnim = useRef(new Animated.Value(1)).current;

  // Flags
  const [rideInProgress, setRideInProgress] = useState(false);
  const [rideCooldown, setRideCooldown] = useState(false);

  // -----------------------------------------------------------------
  // 3. React Navigation
  // -----------------------------------------------------------------
  const navigation = useNavigation();
  const route = useRoute();
  const auth = getAuth();

  // Refs
  const currentRideRequestRef = useRef(null);
  const timerRef = useRef(null);

  // Store the unsubscribe function so we can call it immediately on accept/decline
  const onSnapshotUnsubscribe = useRef(null);

  // Keep a ref so we don't process the same ride doc multiple times
  useEffect(() => {
    currentRideRequestRef.current = currentRideRequest;
  }, [currentRideRequest]);

  // -----------------------------------------------------------------
  // 4. Reset rideInProgress if we come back from RideInProgressScreen
  // -----------------------------------------------------------------
  useEffect(() => {
    if (route.params?.rideCompleted) {
      setRideInProgress(false);
      // navigation.setParams({ rideCompleted: undefined }); // optional
    }
  }, [route.params?.rideCompleted]);

  // -----------------------------------------------------------------
  // 5. Load persisted earnings and last reset from AsyncStorage
  // -----------------------------------------------------------------
  useEffect(() => {
    const loadEarnings = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const earningsKey = `earnings_${currentUser.uid}`;
        const lastResetKey = `lastReset_${currentUser.uid}`;
        try {
          const storedEarnings = await AsyncStorage.getItem(earningsKey);
          const storedLastReset = await AsyncStorage.getItem(lastResetKey);
          if (storedEarnings !== null) {
            setEarnings(parseFloat(storedEarnings));
          }
          if (storedLastReset !== null) {
            setLastReset(parseInt(storedLastReset, 10));
          }
        } catch (error) {
          console.error("Error loading earnings:", error);
        }
      }
    };
    loadEarnings();
  }, []);

  // -----------------------------------------------------------------
  // 6. Fetch Driver's Info (Name, Type, Photo) from Firestore
  // -----------------------------------------------------------------
  useEffect(() => {
    const fetchDriverDataFromFirestore = async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const docRef = doc(db, "Drivers", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setUserName(userData.firstName || "Driver");
            setDriverType(userData.driverType || "");
            setDriverPhoto(userData.photo || currentUser.photoURL || "");
          } else {
            console.log("No such document in Firestore!");
          }
        } catch (error) {
          console.error("Error fetching driver data:", error);
        }
      }
    };
    fetchDriverDataFromFirestore();
  }, []);

  // -----------------------------------------------------------------
  // 7. Get Current Location
  // -----------------------------------------------------------------
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.log("Permission to access location was denied");
          return;
        }
        const currentPosition = await Location.getCurrentPositionAsync({});
        if (currentPosition?.coords) {
          const { latitude, longitude } = currentPosition.coords;
          setFromLocation({ latitude, longitude });
          setRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
      } catch (err) {
        console.error("Error getting location:", err);
      }
    })();
  }, []);

  // -----------------------------------------------------------------
  // 8. Subscribe to Ride Requests if driver is online, not in progress, etc.
  // -----------------------------------------------------------------
  useEffect(() => {
    // If conditions for subscribing are NOT met, clear any existing subscription
    if (!isOnline || rideInProgress || rideCooldown || !driverType) {
      setCurrentRideRequest(null);
      if (onSnapshotUnsubscribe.current) {
        onSnapshotUnsubscribe.current();
        onSnapshotUnsubscribe.current = null;
      }
      return;
    }

    // Otherwise, subscribe to new rides
    const q = query(
      collection(db, "rideRequests"),
      where("status", "==", "waiting"),
      where("rideType", "==", driverType)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) return;

      // We'll just look at the first doc in the snapshot
      const docItem = snapshot.docs[0];
      const ride = { id: docItem.id, ...docItem.data() };

      // Skip if it's the same ride as before
      if (
        currentRideRequestRef.current &&
        currentRideRequestRef.current.id === ride.id
      ) {
        return;
      }

      setCurrentRideRequest(ride);
      setIsLoadingAddress(true);

      try {
        // Calculate distance & time
        const pickupLocation = { latitude: ride.pickupLat, longitude: ride.pickupLng };
        const destinationLocation = {
          latitude: ride.destinationLat,
          longitude: ride.destinationLng,
        };
        const distance = calculateDistance(pickupLocation, destinationLocation);
        setRideDistance(distance);
        const estimatedMinutes = Math.round((distance / 30) * 60);
        setEstimatedTime(estimatedMinutes);

        // Reverse geocode for addresses
        const pickupLoc = await Location.reverseGeocodeAsync(pickupLocation);
        const pickupAddr =
          pickupLoc.length > 0
            ? `${pickupLoc[0].name || ""} ${pickupLoc[0].street || ""}`
            : "Pickup Address Not Found";
        setPickupAddress(pickupAddr);

        const destLoc = await Location.reverseGeocodeAsync(destinationLocation);
        const destAddr =
          destLoc.length > 0
            ? `${destLoc[0].name || ""} ${destLoc[0].street || ""}`
            : "Destination Address Not Found";
        setDestinationAddress(destAddr);
      } catch (error) {
        console.error("Error in reverse geocoding:", error);
        setPickupAddress("Pickup Address Not Available");
        setDestinationAddress("Destination Address Not Available");
      } finally {
        setIsLoadingAddress(false);
        setIsModalVisible(true);
        setTimeLeft(15);
        startTimer();
        Animated.timing(countdownAnim, {
          toValue: 0,
          duration: 15000,
          useNativeDriver: false,
        }).start();
      }
    });

    // Store the unsubscribe so we can manually invoke it if the user accepts/declines
    onSnapshotUnsubscribe.current = unsubscribe;

    // Cleanup when effect re-runs or unmounts
    return () => {
      unsubscribe();
      onSnapshotUnsubscribe.current = null;
    };
  }, [isOnline, rideInProgress, rideCooldown, driverType]);

  // -----------------------------------------------------------------
  // 9. Countdown Timer for Auto-Decline
  // -----------------------------------------------------------------
  useEffect(() => {
    if (isModalVisible && timeLeft === 0) {
      declineRide();
    }
  }, [timeLeft]);

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Reset animation each time
    countdownAnim.setValue(1);

    timerRef.current = setInterval(() => {
      setTimeLeft((prevTime) => {
        if (prevTime <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isModalVisible && timerRef.current) {
      clearInterval(timerRef.current);
    }
  }, [isModalVisible]);

  // -----------------------------------------------------------------
  // 10. Toggle Online/Offline
  // -----------------------------------------------------------------
  const toggleOnlineStatus = () => {
    setIsOnline(!isOnline);
  };

  // -----------------------------------------------------------------
  // 11. Calculate Distance (Haversine formula)
  // -----------------------------------------------------------------
  const calculateDistance = (point1, point2) => {
    const R = 6371; // Earth's radius in km
    const dLat = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const dLon = ((point2.longitude - point1.longitude) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.latitude * Math.PI) / 180) *
        Math.cos((point2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1)); // Distance in km
  };

  // -----------------------------------------------------------------
  // 12. Accept Ride (Immediate unsubscribe + set rideInProgress)
  // -----------------------------------------------------------------
  const acceptRide = async () => {
    if (!currentRideRequest) return;

    // Immediately unsubscribe so we don't get new rides popping up
    if (onSnapshotUnsubscribe.current) {
      onSnapshotUnsubscribe.current();
      onSnapshotUnsubscribe.current = null;
    }

    // Mark rideInProgress right away
    setRideInProgress(true);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser || !fromLocation) {
        console.log("Missing driver or location info.");
        return;
      }
      const driverId = currentUser.uid;

      // Update Firestore doc
      await updateDoc(doc(db, "rideRequests", currentRideRequest.id), {
        status: "assigned",
        driverId,
        driverName: userName,
        driverPhoto: driverPhoto,
      });

      // Close modal
      setIsModalVisible(false);

      // Update local earnings if needed
      if (currentRideRequest.fare) {
        const newEarnings = earnings + currentRideRequest.fare;
        setEarnings(newEarnings);
        const earningsKey = `earnings_${driverId}`;
        await AsyncStorage.setItem(earningsKey, newEarnings.toString());
      }

      // Record in moneyByRider
      const today = new Date();
      const year = today.getFullYear();
      const month = (today.getMonth() + 1).toString().padStart(2, "0");
      const day = today.getDate().toString().padStart(2, "0");
      const docId = `${driverId}_${year}${month}${day}`;
      const moneyDocRef = doc(db, "moneyByRider", docId);

      await setDoc(
        moneyDocRef,
        {
          driverId,
          total: increment(currentRideRequest.fare),
          trips: arrayUnion({
            fare: currentRideRequest.fare,
            timestamp: today.toISOString(),
          }),
        },
        { merge: true }
      );

      // Navigate to in-progress screen
      navigation.navigate("RideInProgressScreen", {
        pickupLat: currentRideRequest.pickupLat,
        pickupLng: currentRideRequest.pickupLng,
        destinationLat: currentRideRequest.destinationLat,
        destinationLng: currentRideRequest.destinationLng,
        driverLat: fromLocation.latitude,
        driverLng: fromLocation.longitude,
        customerName: currentRideRequest.customerName,
        customerPhone: currentRideRequest.customerPhone,
        ridePrice: currentRideRequest.fare,
        customerPhotoURL: currentRideRequest.customerPhotoURL,
      });

      // Clear out current ride state
      setCurrentRideRequest(null);
    } catch (error) {
      console.error("Error accepting ride:", error);
    }
  };

  // -----------------------------------------------------------------
  // 13. Decline Ride (Also unsubscribe to avoid second request)
  // -----------------------------------------------------------------
  const declineRide = async () => {
    if (!currentRideRequest) return;

    // Immediately unsubscribe
    if (onSnapshotUnsubscribe.current) {
      onSnapshotUnsubscribe.current();
      onSnapshotUnsubscribe.current = null;
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      // Mark ride as declined in Firestore
      await updateDoc(doc(db, "rideRequests", currentRideRequest.id), {
        status: "declined",
      });
      console.log("Ride declined:", currentRideRequest.id);

      // Hide the modal and reset
      setIsModalVisible(false);
      setCurrentRideRequest(null);

      // Apply a short cooldown before looking for next rides
      setRideCooldown(true);
      setTimeout(() => setRideCooldown(false), 5000);
    } catch (error) {
      console.error("Error declining ride:", error);
    }
  };

  // -----------------------------------------------------------------
  // 14. Reset Earnings Every 24 Hours
  // -----------------------------------------------------------------
  useEffect(() => {
    const intervalId = setInterval(async () => {
      const now = Date.now();
      if (now - lastReset >= 24 * 60 * 60 * 1000) {
        setEarnings(0);
        setLastReset(now);

        const currentUser = auth.currentUser;
        if (currentUser) {
          const earningsKey = `earnings_${currentUser.uid}`;
          const lastResetKey = `lastReset_${currentUser.uid}`;
          await AsyncStorage.setItem(earningsKey, "0");
          await AsyncStorage.setItem(lastResetKey, now.toString());
        }
      }
    }, 60000);

    return () => clearInterval(intervalId);
  }, [lastReset]);

  // -----------------------------------------------------------------
  // 15. Render
  // -----------------------------------------------------------------
  if (!region) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF8C00" />
        <Text style={styles.loadingText}>
          Getting your current location...
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          {/* Earnings + Settings */}
          <View style={styles.earningsWrapper}>
            <View style={styles.earningsContainer}>
              <Text style={styles.earningsText}>${earnings.toFixed(2)}</Text>
              <Text style={styles.earningsLabel}>Today's Earnings</Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate("SettingsScreen")}
              style={styles.settingsIcon}
            >
              <Ionicons name="settings-outline" size={28} color="#FF8C00" />
            </TouchableOpacity>
          </View>

          {/* Map */}
          <View style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={region}
              showsUserLocation
              onRegionChangeComplete={(reg) => setRegion(reg)}
              customMapStyle={mapStyle}
            >
              {fromLocation && (
                <Marker coordinate={fromLocation} title="Your Location">
                  <View style={styles.customMarker}>
                    <Ionicons name="car" size={24} color="#FF8C00" />
                  </View>
                </Marker>
              )}
            </MapView>
            <View style={styles.onlineButtonContainer}>
              <TouchableOpacity
                style={[
                  styles.onlineButton,
                  isOnline ? styles.onlineButtonActive : {},
                ]}
                onPress={toggleOnlineStatus}
              >
                <Text style={styles.onlineButtonText}>
                  {isOnline ? "ONLINE" : "GO"}
                </Text>
              </TouchableOpacity>
              <Text style={styles.onlineStatusText}>
                {isOnline ? "You're online" : "You're offline"}
              </Text>
            </View>
          </View>

          {/* Ride Request Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={isModalVisible}
            onRequestClose={() => {}}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {isLoadingAddress ? (
                  <ActivityIndicator size="large" color="#FF8C00" />
                ) : (
                  <>
                    <View style={styles.modalHeader}>
                      <Text style={styles.modalTitle}>New Ride Request</Text>
                      <View style={styles.timerContainer}>
                        <Animated.View
                          style={[
                            styles.timerCircle,
                            {
                              borderColor:
                                timeLeft <= 5 ? "#FF3B30" : "#FF8C00",
                            },
                          ]}
                        >
                          <Animated.View
                            style={[
                              styles.timerFill,
                              {
                                backgroundColor:
                                  timeLeft <= 5 ? "#FF3B30" : "#FF8C00",
                                transform: [{ scale: countdownAnim }],
                              },
                            ]}
                          />
                          <Text style={styles.timerText}>{timeLeft}</Text>
                        </Animated.View>
                      </View>
                    </View>

                    <View style={styles.rideCard}>
                      <View style={styles.rideDetails}>
                        <View style={styles.addressSection}>
                          <View style={styles.addressRow}>
                            <View style={styles.addressDot}>
                              <View style={[styles.dot, styles.pickupDot]} />
                            </View>
                            <View style={styles.addressTextContainer}>
                              <Text style={styles.addressLabel}>PICKUP</Text>
                              <Text style={styles.addressText}>
                                {pickupAddress}
                              </Text>
                            </View>
                          </View>

                          <View style={styles.verticalLine} />

                          <View style={styles.addressRow}>
                            <View style={styles.addressDot}>
                              <View
                                style={[styles.dot, styles.destinationDot]}
                              />
                            </View>
                            <View style={styles.addressTextContainer}>
                              <Text style={styles.addressLabel}>
                                DESTINATION
                              </Text>
                              <Text style={styles.addressText}>
                                {destinationAddress}
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.rideStatsContainer}>
                          <View style={styles.rideStat}>
                            <MaterialIcons
                              name="attach-money"
                              size={20}
                              color="#333"
                            />
                            <Text style={styles.rideStatValue}>
                              $
                              {currentRideRequest?.fare
                                ? currentRideRequest.fare.toFixed(2)
                                : "N/A"}
                            </Text>
                            <Text style={styles.rideStatLabel}>Fare</Text>
                          </View>

                          <View style={styles.rideStat}>
                            <FontAwesome5
                              name="route"
                              size={18}
                              color="#333"
                            />
                            <Text style={styles.rideStatValue}>
                              {rideDistance ? `${rideDistance} km` : "N/A"}
                            </Text>
                            <Text style={styles.rideStatLabel}>Distance</Text>
                          </View>

                          <View style={styles.rideStat}>
                            <Ionicons
                              name="time-outline"
                              size={20}
                              color="#333"
                            />
                            <Text style={styles.rideStatValue}>
                              {estimatedTime ? `${estimatedTime} min` : "N/A"}
                            </Text>
                            <Text style={styles.rideStatLabel}>Est. Time</Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    <View style={styles.modalButtons}>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.declineButton]}
                        onPress={declineRide}
                      >
                        <Text style={styles.modalButtonText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalButton, styles.acceptButton]}
                        onPress={acceptRide}
                      >
                        <Text style={styles.modalButtonText}>Accept</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

// -----------------------------------------------------------------
// Custom dark map style
// -----------------------------------------------------------------
const mapStyle = [
  {
    elementType: "geometry",
    stylers: [{ color: "#212121" }],
  },
  {
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
  {
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    elementType: "labels.text.stroke",
    stylers: [{ color: "#212121" }],
  },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#181818" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1b1b1b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#4e4e4e" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }],
  },
];

// -----------------------------------------------------------------
// 16. Styles
// -----------------------------------------------------------------
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    marginTop: 10,
    fontSize: 16,
  },
  earningsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
    paddingHorizontal: 20,
  },
  earningsContainer: {
    marginVertical: 10,
    backgroundColor: "#1A1A1A",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
    elevation: 6,
    flex: 1,
    borderWidth: 1,
    borderColor: "#333333",
  },
  earningsText: {
    color: "#FF8C00",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
  },
  earningsLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    textAlign: "center",
    marginTop: 4,
  },
  settingsIcon: {
    marginLeft: 15,
    backgroundColor: "#1A1A1A",
    padding: 12,
    borderRadius: 50,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: "#333333",
  },
  mapContainer: {
    flex: 1,
    margin: 15,
    borderRadius: 25,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#333333",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  customMarker: {
    backgroundColor: "#000000",
    borderRadius: 50,
    padding: 6,
    borderWidth: 2,
    borderColor: "#FF8C00",
  },
  onlineButtonContainer: {
    position: "absolute",
    bottom: 25,
    alignSelf: "center",
    alignItems: "center",
  },
  onlineButton: {
    backgroundColor: "#FF8C00",
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#333333",
  },
  onlineButtonActive: {
    backgroundColor: "#228B22",
    borderColor: "#006400",
  },
  onlineButtonText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  onlineStatusText: {
    color: "#FFFFFF",
    marginTop: 8,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "90%",
    backgroundColor: "#1A1A1A",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#333333",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  modalTitle: {
    color: "#FF8C00",
    fontSize: 20,
    fontWeight: "bold",
  },
  timerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  timerCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    justifyContent: "center",
    alignItems: "center",
  },
  timerFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 25,
  },
  timerText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  rideCard: {
    backgroundColor: "#2c2c2c",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  rideDetails: {},
  addressSection: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  addressRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  addressDot: {
    marginRight: 8,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF8C00",
  },
  pickupDot: {},
  destinationDot: {
    backgroundColor: "#FF3B30",
  },
  addressTextContainer: {
    flex: 1,
  },
  addressLabel: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  addressText: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  verticalLine: {
    width: 2,
    backgroundColor: "#333333",
    marginHorizontal: 5,
  },
  divider: {
    height: 1,
    backgroundColor: "#333333",
    marginVertical: 10,
  },
  rideStatsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  rideStat: {
    alignItems: "center",
  },
  rideStatValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
    marginVertical: 4,
  },
  rideStatLabel: {
    color: "#CCCCCC",
    fontSize: 12,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    marginHorizontal: 5,
    alignItems: "center",
  },
  declineButton: {
    backgroundColor: "#FF3B30",
  },
  acceptButton: {
    backgroundColor: "#228B22",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});

export default HomeScreenWithMap;
