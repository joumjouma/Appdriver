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
import { GOOGLE_MAPS_APIKEY } from "@env";

// Import your custom pin image
// Replace with your actual asset path
import CustomPin from "../assets/CustomPin.png";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const RideInProgressScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const mapRef = useRef(null);

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
    ridePrice,
    customerName,
    customerPhone,
    customerPhotoURL,
  } = route.params || {};

  // Define initial states
  const [driverLocation, setDriverLocation] = useState(
    driverLat && driverLng ? { latitude: driverLat, longitude: driverLng } : null
  );
  const [pickupLocation] = useState(
    pickupLat && pickupLng ? { latitude: pickupLat, longitude: pickupLng } : null
  );
  const [dropOffLocation] = useState(
    destinationLat && destinationLng ? { latitude: destinationLat, longitude: destinationLng } : null
  );
  const [hasPickedUpCustomer, setHasPickedUpCustomer] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const progressAnimation = useRef(null);
  const longPressTimer = useRef(null);

  // Function to open Google Maps for navigation
  const openGoogleMapsDirections = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url);
    setIsNavigating(true);
  };

  // Function to message the customer
  const messageCustomer = () => {
    if (customerPhone) {
      Linking.openURL(`sms:${customerPhone}`);
    }
  };

  // Automatically adjust the camera to fit all points with improved padding
  useEffect(() => {
    if (mapRef.current && driverLocation) {
      setTimeout(() => {
        fitMapToRoute();
      }, 500); // Short delay to ensure map is ready
    }
  }, []);

  // Function to fit map to show the entire route with more zoom out
  const fitMapToRoute = () => {
    if (mapRef.current && driverLocation) {
      const locations = [driverLocation];
      if (pickupLocation) locations.push(pickupLocation);
      if (dropOffLocation) locations.push(dropOffLocation);

      // Use much larger padding to ensure routes are visible and zoomed out further
      mapRef.current.fitToCoordinates(locations, {
        edgePadding: { top: 150, right: 150, bottom: 450, left: 150 },
        animated: true,
      });
    }
  };

  // Handler for directions ready - FIXED THIS FUNCTION
  const handleDirectionsReady = (result) => {
    if (result && typeof result.distance === 'number' && typeof result.duration === 'number') {
      setDistance(result.distance);
      setDuration(result.duration);
    }
    
    // Re-fit map when directions are ready to ensure entire route is visible
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
      duration: 2000, // Longer duration (2 seconds) for press and hold
      useNativeDriver: false,
    });
    
    progressAnimation.current.start();
    
    // Set a timer to execute callback after the animation completes
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
    fitMapToRoute();
  };

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
          latitudeDelta: 0.15, // Increased to show more of the map initially
          longitudeDelta: 0.15, // Increased to show more of the map initially
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

      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FF6F00" />
        </TouchableOpacity>
      </View>

      {/* Recenter Button */}
      <View style={styles.recenterButtonContainer}>
        <TouchableOpacity onPress={recenterMap}>
          <Ionicons name="locate" size={28} color="#FF6F00" />
        </TouchableOpacity>
      </View>

      {/* Customer Info Banner - Always visible at top */}
      <View style={styles.customerInfoBanner}>
        <View style={styles.avatarContainer}>
          {customerPhotoURL ? (
            <Image source={{ uri: customerPhotoURL }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={24} color="#fff" />
          )}
        </View>
        <View style={styles.customerBannerDetails}>
          <Text style={styles.customerBannerName}>{customerName || "Client"}</Text>
          <Text style={styles.customerBannerPhone}>{customerPhone || "Téléphone non disponible"}</Text>
          <Text style={styles.customerBannerRide}>
            {ridePrice ? `${ridePrice.toFixed(2)} Fdj` : "Prix non disponible"}
          </Text>
        </View>
        <View style={styles.bannerButtonContainer}>
          <TouchableOpacity 
            style={[styles.bannerButton, !customerPhone && styles.disabledButton]} 
            onPress={() => customerPhone && Linking.openURL(`tel:${customerPhone}`)}
            disabled={!customerPhone}
          >
            <Ionicons name="call" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.bannerButton, !customerPhone && styles.disabledButton]} 
            onPress={messageCustomer}
            disabled={!customerPhone}
          >
            <Ionicons name="chatbubble" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Ride Details */}
      <View style={styles.bottomSheet}>
        <Text style={styles.headerText}>
          {hasPickedUpCustomer ? "En route vers la destination" : "En route vers la destination"}
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
            <Text style={styles.rideInfoValue}>{ridePrice ? `${ridePrice.toFixed(2)} Fdj` : "N/A"}</Text>
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
              <Text style={styles.buttonText}>Naviguer vers le pickup</Text>
            </TouchableOpacity>
            
            {/* Hold to confirm button */}
            <TouchableOpacity 
              style={styles.buttonSecondary}
              onPressIn={() => startLongPress(() => setHasPickedUpCustomer(true))}
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
              style={styles.buttonPrimary}
              onPress={() => openGoogleMapsDirections(dropOffLocation.latitude, dropOffLocation.longitude)}
              disabled={isNavigating}
            >
              <Text style={styles.buttonText}>Naviguer vers le drop-off</Text>
            </TouchableOpacity>
            
            {/* Hold to confirm button */}
            <TouchableOpacity 
              style={styles.buttonSecondary}
              onPressIn={() => startLongPress(() => navigation.navigate("HomeScreenWithMap", { rideCompleted: true }))}
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

export default RideInProgressScreen;

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
  backButtonContainer: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterButtonContainer: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  customerInfoBanner: {
    position: "absolute",
    top: 90,
    left: 20,
    right: 20,
    zIndex: 100,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 15,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#FF6F00",
  },
  customerBannerDetails: {
    flex: 1,
    marginLeft: 10,
  },
  customerBannerName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  customerBannerPhone: {
    color: "#b3b3b3",
    fontSize: 14,
  },
  customerBannerRide: {
    color: "#FF6F00",
    fontSize: 14,
    marginTop: 2,
  },
  bannerButtonContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  bannerButton: {
    backgroundColor: "#FF6F00",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
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
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF6F00",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 0,
    overflow: "hidden",
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  disabledButton: {
    backgroundColor: "#5F5F5F",
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
});