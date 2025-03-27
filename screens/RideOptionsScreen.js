import React, { useRef, useState } from "react";
import { 
  View,
  Text,
  StyleSheet,
  TouchableOpacity, 
  SafeAreaView
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { GOOGLE_MAPS_APIKEY } from "@env";

const RideOptionsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // Grab origin & destination (if passed in)
  const { origin, destination } = route.params || {};

  // Reference for MapView
  const mapRef = useRef(null);

  // Initial region fallback (San Francisco example)
  const initialRegion = {
    latitude: origin?.latitude || 37.7749,
    longitude: origin?.longitude || -122.4194,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  };

  // ----------------------------
  // STATE FOR DISTANCE, DURATION, & FARES
  // ----------------------------
  const [distance, setDistance] = useState(0);    // in km
  const [duration, setDuration] = useState(0);    // in minutes

  const [cavalPriveFare, setCavalPriveFare] = useState(0);
  const [cavalPoolFare, setCavalPoolFare] = useState(390); // or your own logic
  const [cavalTaxiFare, setCavalTaxiFare] = useState(0);

  // Track which ride option is selected
  const [selectedRide, setSelectedRide] = useState(null);

  // Helper to format arrival times (e.g. "3:15 PM")
  const getFormattedArrivalTime = (extraMinutes) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + extraMinutes);

    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12; // convert to 12-hour

    const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${paddedMinutes} ${ampm}`;
  };

  const handleRideSelect = (ride) => {
    setSelectedRide(ride);
  };

  const handleChoose = () => {
    if (!selectedRide) {
      alert("Please select a ride first.");
      return;
    }
    // Navigate to the "FindingDriverScreen" and pass along relevant data
    navigation.navigate("FindingDriver", { 
      rideType: selectedRide,
      distance,
      duration 
    });
  };

  return (
    <View style={styles.container}>
      {/* MAP SECTION */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialRegion}
      >
        {/* Origin Marker */}
        {origin && (
          <Marker
            coordinate={origin}
            title="Origin"
            pinColor="green"
          />
        )}

        {/* Destination Marker */}
        {destination && (
          <Marker
            coordinate={destination}
            title="Destination"
            pinColor="red"
          />
        )}

        {/* Draw route if both origin & destination */}
        {origin && destination && (
          <MapViewDirections
            origin={origin}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF6F00"
            onReady={(result) => {
              // Fit route to screen
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                animated: true,
              });

              // Store distance & duration
              setDistance(result.distance);    // in km
              setDuration(result.duration);    // in minutes

              // Compute fares
              setCavalPriveFare(Math.round(result.distance * 65));
              setCavalTaxiFare(Math.round(result.distance * 55));
              // Caval Pool remains as you like
            }}
          />
        )}
      </MapView>

      {/* RIDE OPTIONS PANEL */}
      <View style={styles.bottomSheet}>
        <Text style={styles.headerText}>Choisi une méthode de transport</Text>

        {/* Caval Privé */}
        <TouchableOpacity
          style={[
            styles.rideOptionLarge,
            selectedRide === "Caval Privé" && styles.selectedOption
          ]}
          onPress={() => handleRideSelect("Caval Privé")}
        >
          <Ionicons 
            name="car" 
            size={36} 
            color="#FF6F00" 
            style={styles.icon} 
          />
          <View style={styles.infoContainer}>
            <Text style={styles.rideTitleLarge}>Caval Privé</Text>
            <Text style={styles.rideSubtitleLarge}>
              Arrive vers {getFormattedArrivalTime(duration)} • {distance.toFixed(1)} km
            </Text>
          </View>
          <Text style={styles.priceLarge}>{cavalPriveFare} Fdj</Text>
        </TouchableOpacity>

        {/* Caval Pool */}
        <TouchableOpacity
          style={[
            styles.rideOptionLarge,
            selectedRide === "Caval Pool" && styles.selectedOption
          ]}
          onPress={() => handleRideSelect("Caval Pool")}
        >
          <Ionicons 
            name="car-sport" 
            size={36} 
            color="#FF6F00" 
            style={styles.icon} 
          />
          <View style={styles.infoContainer}>
            <Text style={styles.rideTitleLarge}>Caval Pool</Text>
            <Text style={styles.rideSubtitleLarge}>
              Arrive vers {getFormattedArrivalTime(duration)} • {distance.toFixed(1)} km
            </Text>
            <Text style={[styles.rideSubtitleLarge, { color: "blue" }]}>
              Save up to 20% if shared
            </Text>
          </View>
          <Text style={styles.priceLarge}>{cavalPoolFare} Fdj</Text>
        </TouchableOpacity>

        {/* Caval Taxi */}
        <TouchableOpacity
          style={[
            styles.rideOptionLarge,
            selectedRide === "Caval Taxi" && styles.selectedOption
          ]}
          onPress={() => handleRideSelect("Caval Taxi")}
        >
          {/** CHANGED HERE: replaced name="taxi" with a valid Ionicon, e.g. "car-sharp" */}
          <Ionicons 
            name="car-sharp" 
            size={36} 
            color="#FF6F00" 
            style={styles.icon} 
          />
          <View style={styles.infoContainer}>
            <Text style={styles.rideTitleLarge}>Caval Taxi</Text>
            <Text style={styles.rideSubtitleLarge}>
              Arrive vers {getFormattedArrivalTime(duration)} • {distance.toFixed(1)} km
            </Text>
          </View>
          <Text style={styles.priceLarge}>{cavalTaxiFare} Fdj</Text>
        </TouchableOpacity>

        {/* PAYMENT ROW */}
        <View style={styles.paymentRow}>
          <Ionicons name="card-outline" size={24} color="#000" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.paymentTitle}>Personal</Text>
            <Text style={styles.paymentSubtitle}>Visa ---2813</Text>
          </View>
        </View>

        {/* CHOOSE BUTTON */}
        <TouchableOpacity style={styles.chooseButton} onPress={handleChoose}>
          <Text style={styles.chooseButtonText}>Choisir</Text>
        </TouchableOpacity>
      </View>

      {/* (OPTIONAL) BOTTOM NAVIGATION BAR */}
      <SafeAreaView style={styles.navBarContainer}>
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="home" size={24} color="#FF6F00" />
            <Text style={styles.navLabel}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="time-outline" size={24} color="#888" />
            <Text style={styles.navLabel}>Activity</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <Ionicons name="person-outline" size={24} color="#888" />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

export default RideOptionsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 70, // space for bottom nav bar
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 15,
    paddingHorizontal: 15,
    elevation: 5,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
  },
  rideOptionLarge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingVertical: 12,
  },
  selectedOption: {
    backgroundColor: "#f0f0f0", // highlight color
    borderRadius: 10,
  },
  icon: {
    marginRight: 12,
  },
  infoContainer: {
    flex: 1,
  },
  rideTitleLarge: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  rideSubtitleLarge: {
    fontSize: 16,
    color: "#666",
  },
  priceLarge: {
    fontSize: 18,
    fontWeight: "700",
    color: "#000",
    marginLeft: 8,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  paymentSubtitle: {
    fontSize: 12,
    color: "#666",
  },
  chooseButton: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  chooseButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  navBarContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
  },
  navBar: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
  },
  navLabel: {
    fontSize: 12,
    marginTop: 4,
    color: "#333",
  },
});
