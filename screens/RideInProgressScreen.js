import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Linking,
  ActivityIndicator,
  Image,
  Animated,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, updateDoc, serverTimestamp, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { getAuth } from "firebase/auth";
import { createConversation } from "../utils/messaging";

// Import your custom pin image
import CustomPin from "../assets/CustomPin.png";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const RideInProgressScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const GOOGLE_MAPS_APIKEY = "AIzaSyBH87gAekJEssZuAX-q3lwjDjLRr0jXMNs";

  // Initialize customer info from route params
  const [customerInfo, setCustomerInfo] = useState({
    firstName: route.params?.firstName || "",
    number: route.params?.number || "",
    photo: route.params?.photo || "",
    price: route.params?.ridePrice || 0
  });

  // Extract parameters from route
  const {
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    pickupAddress,
    destinationAddress,
    driverLat,
    driverLng,
    rideId,
  } = route.params || {};

  console.log('Route params:', {
    pickupLat,
    pickupLng,
    destinationLat,
    destinationLng,
    pickupAddress,
    destinationAddress,
    driverLat,
    driverLng,
    rideId,
  });

  // Define initial states
  const [driverLocation, setDriverLocation] = useState(
    driverLat && driverLng ? { latitude: driverLat, longitude: driverLng } : null
  );
  const [pickupLocation] = useState(
    pickupLat && pickupLng ? { latitude: pickupLat, longitude: pickupLng } : null
  );
  const [dropOffLocation, setDropOffLocation] = useState(() => {
    console.log('Initializing dropOffLocation with:', {
      destinationLat,
      destinationLng,
      routeParams: route.params
    });
    
    if (destinationLat && destinationLng) {
      const location = {
        latitude: destinationLat,
        longitude: destinationLng
      };
      console.log('Created dropOffLocation:', location);
      return location;
    }
    console.log('No destination coordinates available');
    return null;
  });
  const [hasPickedUpCustomer, setHasPickedUpCustomer] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);
  const longPressTimer = useRef(null);
  const [currentRideId, setCurrentRideId] = useState(rideId);

  // Add listener for ride status changes
  useEffect(() => {
    if (!currentRideId) return;

    const rideRequestRef = doc(db, "rideRequests", currentRideId);
    const unsubscribe = onSnapshot(rideRequestRef, (doc) => {
      if (doc.exists()) {
        const rideData = doc.data();
        if (rideData.status === "declined") {
          // Clear ride state and navigate back to home screen
          clearRideState();
          navigation.navigate("HomeScreenWithMap");
        }
      }
    });

    return () => unsubscribe();
  }, [currentRideId]);

  // Store ride state in AsyncStorage when component mounts
  useEffect(() => {
    const storeRideState = async () => {
      try {
        console.log('Storing ride state with customer info:', {
          firstName: customerInfo.firstName,
          number: customerInfo.number,
          photo: customerInfo.photo,
          ridePrice: customerInfo.price
        });
        
        const rideState = {
          pickupLat,
          pickupLng,
          destinationLat,
          destinationLng,
          pickupAddress,
          destinationAddress,
          driverLat,
          driverLng,
          ridePrice: customerInfo.price,
          firstName: customerInfo.firstName,
          number: customerInfo.number,
          photo: customerInfo.photo,
          hasPickedUpCustomer,
          rideId: currentRideId,
        };
        
        await AsyncStorage.setItem('currentRide', JSON.stringify(rideState));
        console.log('Successfully stored ride state');
      } catch (error) {
        console.error('Error storing ride state:', error);
      }
    };

    if (route.params) {
      storeRideState();
    }
  }, [pickupLat, pickupLng, destinationLat, destinationLng, pickupAddress, destinationAddress, 
      driverLat, driverLng, customerInfo, hasPickedUpCustomer, currentRideId]);

  // Check for existing ride state on mount
  useEffect(() => {
    const checkExistingRide = async () => {
      try {
        const storedRide = await AsyncStorage.getItem('currentRide');
        console.log('Checking existing ride:', storedRide);
        if (storedRide) {
          const rideState = JSON.parse(storedRide);
          console.log('Found stored ride state:', rideState);
          // Only restore if we don't have route params
          if (!route.params) {
            setHasPickedUpCustomer(rideState.hasPickedUpCustomer);
            setCurrentRideId(rideState.rideId);
            setCustomerInfo({
              firstName: rideState.firstName || "",
              number: rideState.number || "",
              photo: rideState.photo || "",
              price: rideState.ridePrice || 0
            });
            navigation.setParams(rideState);
          }
        }
      } catch (error) {
        console.error('Error checking existing ride:', error);
      }
    };

    checkExistingRide();
  }, []);

  // Update ride status in Firebase when component mounts
  useEffect(() => {
    const updateRideStatus = async () => {
      try {
        const rideIdToUse = rideId || currentRideId;
        
        if (rideIdToUse) {
          console.log("Updating ride status to active for ride:", rideIdToUse);
          const rideRequestRef = doc(db, "rideRequests", rideIdToUse);
          await updateDoc(rideRequestRef, {
            status: "active",
            updatedAt: serverTimestamp()
          });

          // Fetch customer information from rideRequestsDriver
          const rideRequestDriverRef = doc(db, "rideRequestsDriver", rideIdToUse);
          const rideRequestDriverDoc = await getDoc(rideRequestDriverRef);
          
          if (rideRequestDriverDoc.exists()) {
            const rideData = rideRequestDriverDoc.data();
            setCustomerInfo({
              firstName: rideData.firstName || "",
              number: rideData.number || "",
              photo: rideData.photo || "",
              price: rideData.fare || 0
            });
          }
        } else {
          console.warn("No rideId available to update status");
        }
      } catch (error) {
        console.error("Error updating ride status:", error);
      }
    };

    updateRideStatus();
  }, [rideId, currentRideId]);

  // Clear ride state and update Firebase when ride is completed
  const clearRideState = async () => {
    try {
      const rideIdToUse = rideId || currentRideId;
      
      if (rideIdToUse) {
        console.log("Completing ride:", rideIdToUse);
        const rideRequestRef = doc(db, "rideRequests", rideIdToUse);
        await updateDoc(rideRequestRef, {
          status: "completed",
          updatedAt: serverTimestamp(),
          completedAt: serverTimestamp()
        });

        // Update driver's status to be available for new rides
        const auth = getAuth();
        if (auth.currentUser) {
          const driverRef = doc(db, "Drivers", auth.currentUser.uid);
          await updateDoc(driverRef, {
            isAvailable: true,
            currentRideId: null,
            lastRideCompletedAt: serverTimestamp()
          });
        }
      } else {
        console.warn("No rideId available to complete ride");
      }
      
      await AsyncStorage.removeItem('currentRide');
    } catch (error) {
      console.error('Error completing ride:', error);
    }
  };

  // Function to open Google Maps for navigation
  const openGoogleMapsDirections = (lat, lng) => {
    console.log('Opening navigation to:', { lat, lng });
    if (!lat || !lng) {
      console.error('Invalid coordinates:', { lat, lng });
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    console.log('Navigation URL:', url);
    Linking.openURL(url)
      .then(() => {
        // Reset isNavigating after a short delay to ensure the navigation has started
        setTimeout(() => {
          setIsNavigating(false);
        }, 1000);
      })
      .catch(error => {
        console.error('Error opening navigation:', error);
        setIsNavigating(false);
      });
    setIsNavigating(true);
  };

  // Function to handle phone calls
  const handlePhoneCall = () => {
    if (customerInfo.number) {
      const formattedPhone = customerInfo.number.replace(/\D/g, '');
      console.log('Calling phone number:', formattedPhone);
      Linking.openURL(`tel:${formattedPhone}`).catch(err => {
        console.error('Error opening phone dialer:', err);
      });
    }
  };

  // Function to message the customer
  const messageCustomer = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.error('No authenticated user found');
        return;
      }
      
      // Get the customer ID from route params
      let customerId = route.params?.customerId;
      
      // If customerId is not in route params, try to get it from the rideId
      if (!customerId && route.params?.rideId) {
        try {
          console.log('No customerId in route params, fetching from rideId:', route.params.rideId);
          const rideRequestRef = doc(db, "rideRequests", route.params.rideId);
          const rideRequestDoc = await getDoc(rideRequestRef);
          
          if (rideRequestDoc.exists()) {
            const rideData = rideRequestDoc.data();
            customerId = rideData.userId || rideData.customerId;
            console.log('Found customerId from ride request:', customerId);
          }
        } catch (error) {
          console.error('Error fetching customer ID from ride request:', error);
        }
      }
      
      if (!customerId) {
        console.error('No customer ID found in route params or ride request');
        // Fallback to SMS if customerId is not available
        if (customerInfo.number) {
          const formattedPhone = customerInfo.number.replace(/\D/g, '');
          Linking.openURL(`sms:${formattedPhone}`).catch(err => {
            console.error('Error opening messaging app:', err);
          });
        }
        return;
      }
      
      console.log('Creating conversation between driver:', currentUser.uid, 'and customer:', customerId);
      
      // Create a conversation with the customer
      const conversationId = await createConversation(currentUser.uid, customerId);
      
      console.log('Conversation created with ID:', conversationId);
      
      // Navigate to the inbox screen with the conversation ID
      navigation.navigate('DriverInboxScreen', { 
        conversationId,
        customerName: `${customerInfo.firstName} ${route.params?.lastName || ''}`,
        customerPhoto: customerInfo.photo
      });
    } catch (error) {
      console.error('Error creating conversation:', error);
      // Fallback to SMS if in-app messaging fails
      if (customerInfo.number) {
        const formattedPhone = customerInfo.number.replace(/\D/g, '');
        Linking.openURL(`sms:${formattedPhone}`).catch(err => {
          console.error('Error opening messaging app:', err);
        });
      }
    }
  };

  // Automatically adjust the camera to fit all points with improved padding
  useEffect(() => {
    if (mapRef.current && driverLocation) {
      setTimeout(() => {
        fitMapToRoute();
      }, 500);
    }
  }, []);

  // Function to fit map to show the entire route with more zoom out
  const fitMapToRoute = () => {
    if (mapRef.current && driverLocation) {
      const locations = [];
      
      // Always include driver location
      locations.push(driverLocation);
      
      // Add relevant destination based on ride state
      if (!hasPickedUpCustomer && pickupLocation) {
        locations.push(pickupLocation);
      } else if (hasPickedUpCustomer && dropOffLocation) {
        locations.push(dropOffLocation);
      }

      // Add extra padding for better visibility
      const padding = {
        top: 200,
        right: 100,
        bottom: 500,
        left: 100
      };

      mapRef.current.fitToCoordinates(locations, {
        edgePadding: padding,
        animated: true,
      });
    }
  };

  // Handler for directions ready
  const handleDirectionsReady = (result) => {
    if (result && typeof result.distance === 'number' && typeof result.duration === 'number') {
      setDistance(result.distance);
      setDuration(result.duration);
    }
    
    fitMapToRoute();
  };

  // Function to get formatted arrival time
  const getFormattedArrivalTime = (extraMinutes) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + extraMinutes);
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${paddedMinutes} ${ampm}`;
  };

  // Functions to handle long press for pickup button
  const startLongPress = (callback) => {
    setPressing(true);
    progressAnimation.current = Animated.timing(progress, {
      toValue: 1,
      duration: 2000,
      useNativeDriver: false,
    });
    
    progressAnimation.current.start();
    
    longPressTimer.current = setTimeout(() => {
      callback();
      resetPress();
    }, 2000);
  };

  const cancelLongPress = () => {
    if (progressAnimation.current) {
      progressAnimation.current.stop();
    }
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
    resetPress();
  };

  const resetPress = () => {
    progress.setValue(0);
    setPressing(false);
  };

  // Recenter map to show full route
  const recenterMap = () => {
    // Add a small delay to ensure smooth recentering
    setTimeout(() => {
      fitMapToRoute();
    }, 100);
  };

  // Update ride status when customer is picked up
  const handleCustomerPickup = async () => {
    try {
      setHasPickedUpCustomer(true);
      
      const rideIdToUse = rideId || currentRideId;
      if (rideIdToUse) {
        const rideRequestRef = doc(db, "rideRequests", rideIdToUse);
        await updateDoc(rideRequestRef, {
          customerPickedUp: true,
          pickupTime: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error updating pickup status:", error);
    }
  };

  // Log state changes
  useEffect(() => {
    console.log('State updated:', {
      hasPickedUpCustomer,
      dropOffLocation,
      destinationLat,
      destinationLng
    });
  }, [hasPickedUpCustomer, dropOffLocation, destinationLat, destinationLng]);

  // Loading state
  if (!pickupLocation || !driverLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6F00" />
        <Text style={{ color: "#fff", marginTop: 10 }}>Chargement...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: driverLocation.latitude,
          longitude: driverLocation.longitude,
          latitudeDelta: 0.15,
          longitudeDelta: 0.15,
        }}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Route: Driver → Pickup */}
        {!hasPickedUpCustomer && (
          <MapViewDirections
            origin={driverLocation}
            destination={pickupLocation}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF6F00"
            onReady={handleDirectionsReady}
          />
        )}

        {/* Route: Pickup → Drop-off */}
        {dropOffLocation && (
          <MapViewDirections
            origin={hasPickedUpCustomer ? driverLocation : pickupLocation}
            destination={dropOffLocation}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF6F00"
            onReady={handleDirectionsReady}
          />
        )}

        {/* Pickup Marker - Only show if not picked up yet */}
        {!hasPickedUpCustomer && (
          <Marker coordinate={pickupLocation}>
            <View style={styles.markerContainer}>
              <Image source={CustomPin} style={styles.pin} resizeMode="contain" />
              <Text style={styles.markerLabel} numberOfLines={2} ellipsizeMode="tail">
                {pickupAddress || "Point de départ"}
              </Text>
            </View>
          </Marker>
        )}

        {/* Drop-off Marker */}
        {dropOffLocation && (
          <Marker coordinate={dropOffLocation}>
            <View style={styles.markerContainer}>
              <Image source={CustomPin} style={styles.pin} resizeMode="contain" />
              <Text style={styles.markerLabel} numberOfLines={2} ellipsizeMode="tail">
                {destinationAddress || "Destination"}
              </Text>
            </View>
          </Marker>
        )}

        {/* Driver Marker */}
        <Marker coordinate={driverLocation} title="Driver">
          <View style={styles.driverMarkerContainer}>
            <Ionicons name="car" size={24} color="#FF6F00" />
          </View>
        </Marker>
      </MapView>

      {/* Recenter Button */}
      <View style={styles.recenterButtonContainer}>
        <TouchableOpacity onPress={recenterMap}>
          <Ionicons name="locate" size={28} color="#FF6F00" />
        </TouchableOpacity>
      </View>

      {/* Customer Info Banner */}
      <View style={styles.newCustomerBanner}>
        <View style={styles.newBannerHeader}>
          <View style={styles.newAvatarContainer}>
            {customerInfo.photo ? (
              <Image 
                source={{ uri: customerInfo.photo }} 
                style={styles.newAvatarImage} 
                resizeMode="cover"
              />
            ) : (
              <Ionicons name="person" size={24} color="#fff" />
            )}
          </View>
          <View style={styles.newCustomerInfo}>
            <Text style={styles.newCustomerFirstName}>
              {customerInfo.firstName || "Client"}
            </Text>
            <Text style={styles.newCustomerPhone}>
              {customerInfo.number || "Téléphone non disponible"}
            </Text>
            <Text style={styles.newRidePrice}>
              {customerInfo.price ? `${customerInfo.price.toFixed(2)} Fdj` : "Prix non disponible"}
            </Text>
          </View>
        </View>
        
        <View style={styles.newActionButtons}>
          <TouchableOpacity 
            style={styles.newActionButton} 
            onPress={handlePhoneCall}
            activeOpacity={0.7}
          >
            <Ionicons name="call" size={24} color="#fff" />
            <Text style={styles.newButtonText}>Appeler</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.newActionButton} 
            onPress={messageCustomer}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble" size={24} color="#fff" />
            <Text style={styles.newButtonText}>Message</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Ride Details */}
      <View style={styles.bottomSheet}>
        <Text style={styles.headerText}>
          {hasPickedUpCustomer ? "En route vers la destination" : "En route vers le client"}
        </Text>

        {/* Ride Info */}
        <View style={styles.rideInfoContainer}>
          <View style={styles.rideInfoItem}>
            <Text style={styles.rideInfoLabel}>Distance</Text>
            <Text style={styles.rideInfoValue}>{distance ? distance.toFixed(1) : "0.0"} km</Text>
          </View>
          <View style={styles.rideInfoItem}>
            <Text style={styles.rideInfoLabel}>Durée</Text>
            <Text style={styles.rideInfoValue}>{duration ? Math.round(duration) : "0"} min</Text>
          </View>
          <View style={styles.rideInfoItem}>
            <Text style={styles.rideInfoLabel}>Tarif</Text>
            <Text style={styles.rideInfoValue}>
              {customerInfo.price ? `${customerInfo.price.toFixed(2)} Fdj` : "N/A"}
            </Text>
          </View>
        </View>

        {/* Current destination details */}
        <View style={styles.destinationInfo}>
          <Ionicons name="location" size={24} color="#FF6F00" />
          <View style={styles.destinationTextContainer}>
            <Text style={styles.destinationText} numberOfLines={2}>
              {hasPickedUpCustomer ? destinationAddress || "Destination" : pickupAddress || "Point de départ"}
            </Text>
            <Text style={styles.arrivalTime}>
              {hasPickedUpCustomer 
                ? `Arrivée vers ${getFormattedArrivalTime(duration)}` 
                : `Arrivée vers ${getFormattedArrivalTime(duration / 2)}`}
            </Text>
          </View>
        </View>

        {/* Ride Buttons */}
        {!hasPickedUpCustomer ? (
          <>
            <TouchableOpacity 
              style={styles.buttonPrimary}
              onPress={() => openGoogleMapsDirections(pickupLocation.latitude, pickupLocation.longitude)}
              disabled={isNavigating}
            >
              <Text style={styles.buttonText}>Naviguer vers le client</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.buttonSecondary}
              onPressIn={() => startLongPress(handleCustomerPickup)}
              onPressOut={cancelLongPress}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>
                {pressing ? "Maintenez pour confirmer..." : "Client pris en charge"}
              </Text>
              <View style={styles.progressContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity 
              style={[
                styles.buttonPrimary,
                (!dropOffLocation || isNavigating) && styles.disabledButton
              ]}
              onPress={() => {
                console.log('Navigation button pressed');
                console.log('Current state:', {
                  hasPickedUpCustomer,
                  isNavigating,
                  dropOffLocation,
                  destinationLat,
                  destinationLng
                });
                if (dropOffLocation) {
                  console.log('Opening navigation with coordinates:', {
                    latitude: dropOffLocation.latitude,
                    longitude: dropOffLocation.longitude
                  });
                  openGoogleMapsDirections(dropOffLocation.latitude, dropOffLocation.longitude);
                } else {
                  console.error('No drop-off location available');
                }
              }}
              disabled={isNavigating || !dropOffLocation}
            >
              <Text style={styles.buttonText}>Naviguer vers la destination</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.buttonSecondary}
              onPressIn={() => startLongPress(async () => {
                await clearRideState();
                navigation.navigate("HomeScreenWithMap", { rideCompleted: true });
              })}
              onPressOut={cancelLongPress}
              activeOpacity={0.9}
            >
              <Text style={styles.buttonText}>
                {pressing ? "Maintenez pour confirmer..." : "Client déposé"}
              </Text>
              <View style={styles.progressContainer}>
                <Animated.View
                  style={[
                    styles.progressBar,
                    {
                      width: progress.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: "#121212",
  },
  loadingContainer: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    backgroundColor: "#121212" 
  },
  map: { 
    flex: 1 
  },
  markerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.9)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    maxWidth: 220,
    borderWidth: 1,
    borderColor: "#FF6F00",
  },
  driverMarkerContainer: {
    backgroundColor: "#1E1E1E",
    borderRadius: 50,
    padding: 8,
    borderWidth: 2,
    borderColor: "#FF6F00",
  },
  pin: {
    width: 25,
    height: 25,
    marginRight: 8,
  },
  markerLabel: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 170,
    flexShrink: 1,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: 24,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 20,
    textAlign: "center",
  },
  rideInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  rideInfoItem: {
    flex: 1,
    backgroundColor: "#2C2C2C",
    borderRadius: 10,
    padding: 10,
    marginHorizontal: 5,
    alignItems: "center",
  },
  rideInfoLabel: {
    color: "#b3b3b3",
    fontSize: 14,
    marginBottom: 5,
  },
  rideInfoValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  destinationInfo: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  destinationTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  destinationText: {
    color: "#fff",
    fontSize: 16,
  },
  arrivalTime: {
    color: "#FF6F00",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  buttonPrimary: {
    backgroundColor: "#FF6F00",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    position: "relative",
    overflow: "hidden",
  },
  buttonSecondary: {
    backgroundColor: "#2C2C2C",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 2,
    borderColor: "#FF6F00",
    position: "relative",
    overflow: "hidden",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#fff",
  },
  disabledButton: {
    backgroundColor: "#5F5F5F",
    opacity: 0.5,
  },
  newCustomerBanner: {
    position: "absolute",
    top: 90,
    left: 20,
    right: 20,
    zIndex: 100,
    backgroundColor: "rgba(30, 30, 30, 0.95)",
    borderRadius: 15,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#FF6F00",
  },
  newBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  newAvatarContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#FF6F00",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    overflow: "hidden",
  },
  newAvatarImage: {
    width: "100%",
    height: "100%",
  },
  newCustomerInfo: {
    flex: 1,
  },
  newCustomerFirstName: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  newCustomerPhone: {
    color: "#b3b3b3",
    fontSize: 16,
    marginBottom: 4,
  },
  newRidePrice: {
    color: "#FF6F00",
    fontSize: 18,
    fontWeight: "600",
  },
  newActionButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  newActionButton: {
    backgroundColor: "#FF6F00",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 120,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  newButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  newDisabledButton: {
    backgroundColor: "#5F5F5F",
    opacity: 0.5,
  },
});

export default RideInProgressScreen;