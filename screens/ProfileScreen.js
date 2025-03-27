import React, { useEffect, useState } from "react";
import { auth, db } from "./firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

function Profile() {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  // Fetch the driver's data from Firestore
  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (user) {
      try {
        const docRef = doc(db, "Drivers", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserDetails(docSnap.data());
        } else {
          console.log("No such document!");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    } else {
      console.log("User is not logged in");
      navigation.navigate("LoginScreen");
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // Allow the user to change their profile picture
  const handleProfilePictureChange = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in to change your profile picture.");
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!result.canceled) {
        setLoading(true);
        const imageUri = result.assets[0].uri;
        const docRef = doc(db, "Drivers", user.uid);
        await updateDoc(docRef, { photo: imageUri });
        setUserDetails((prev) => ({ ...prev, photo: imageUri }));
        Alert.alert("Success", "Profile picture updated successfully.");
      }
    } catch (error) {
      console.error("Error updating profile picture:", error);
      Alert.alert("Error", "Unable to update profile picture.");
    } finally {
      setLoading(false);
    }
  };

  // Logout function
  async function handleLogout() {
    try {
      await auth.signOut();
      navigation.navigate("LoginScreen");
    } catch (error) {
      Alert.alert("Error", error.message, [{ text: "OK" }]);
    }
  }

  if (!userDetails) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#ff9f43" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header Section with Profile Picture, User Name & Star Rating */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.profilePicContainer}
          onPress={handleProfilePictureChange}
        >
          {userDetails.photo ? (
            <Image source={{ uri: userDetails.photo }} style={styles.profilePic} />
          ) : (
            <View style={styles.placeholderPic}>
              <Text style={styles.placeholderText}>
                {userDetails.firstName.charAt(0)}
              </Text>
            </View>
          )}
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
        <Text style={styles.userName}>
          {userDetails.firstName} {userDetails.lastName}
        </Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={20} color="#ff9f43" style={styles.starIcon} />
          <Ionicons name="star" size={20} color="#ff9f43" style={styles.starIcon} />
          <Ionicons name="star" size={20} color="#ff9f43" style={styles.starIcon} />
          <Ionicons name="star" size={20} color="#ff9f43" style={styles.starIcon} />
          <Ionicons name="star-half" size={20} color="#ff9f43" style={styles.starIcon} />
          <Text style={styles.ratingText}> 4.75</Text>
        </View>
      </View>

      {/* Menu Section with Inbox, Help, and Earnings */}
      <View style={styles.menuSection}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Inbox")}
        >
          <Ionicons
            name="mail-outline"
            size={28}
            color="#ff9f43"
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Inbox</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("Help")}
        >
          <Ionicons
            name="help-circle-outline"
            size={28}
            color="#ff9f43"
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Help</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate("EarningsScreen")}
        >
          <Ionicons
            name="cash-outline"
            size={28}
            color="#ff9f43"
            style={styles.menuIcon}
          />
          <Text style={styles.menuText}>Earnings</Text>
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default Profile;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1F1F1F",
    padding: 100,
    paddingBottom: 90,
    minHeight: "100%",
  },
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  profilePicContainer: {
    alignItems: "center",
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#ff9f43",
  },
  placeholderPic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#2E2E2E",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 48,
    color: "#FFFFFF",
  },
  editText: {
    marginTop: 5,
    fontSize: 14,
    color: "#ff9f43",
  },
  userName: {
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 15,
    color: "#FFFFFF",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  starIcon: {
    marginRight: 4,
  },
  ratingText: {
    fontSize: 18,
    color: "#ff9f43",
    fontWeight: "600",
  },
  menuSection: {
    marginVertical: 30,
  },
  menuItem: {
    width: "100%", // Expanded to fill the container horizontally
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E2E2E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  menuIcon: {
    marginRight: 15,
  },
  menuText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "bold",
  },
  logoutButton: {
    backgroundColor: "#ff9f43",
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 30,
  },
  logoutButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
});
