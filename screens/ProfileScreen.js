import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  StatusBar,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage, db } from "../config/firebase";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";

const { width } = Dimensions.get("window");

function Profile() {
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(80);
  const [showPhotoPrompt, setShowPhotoPrompt] = useState(false);
  const navigation = useNavigation();
  const { colors } = useTheme();
  const auth = getAuth();

  useEffect(() => {
    const checkFirstVisit = async () => {
      try {
        const hasVisitedProfile = await AsyncStorage.getItem('hasVisitedProfile');
        if (!hasVisitedProfile) {
          // First time visiting profile
          setShowPhotoPrompt(true);
          await AsyncStorage.setItem('hasVisitedProfile', 'true');
        }
      } catch (error) {
        console.error("Error checking first visit:", error);
      }
    };

    const fetchUserDetails = async () => {
      try {
        // First try to get data from AsyncStorage
        const storedData = await AsyncStorage.getItem('driverInfo');
        if (storedData) {
          console.log("Found stored driver data:", JSON.parse(storedData));
          const parsedData = JSON.parse(storedData);
          setUserDetails(parsedData);
          
          // Check if user already has a photo
          if (!parsedData.photo) {
            checkFirstVisit();
          }
          
          setLoading(false);
          return;
        }

        // If not in AsyncStorage, fetch from Firestore
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        console.log("Fetching from Firestore for user:", currentUser.uid);
        const docRefDriver = doc(db, "Drivers", currentUser.uid);
        const docSnapDriver = await getDoc(docRefDriver);

        if (docSnapDriver.exists()) {
          const data = docSnapDriver.data();
          console.log("Fetched driver data from Firestore:", data);
          setUserDetails(data);
          
          // Store in AsyncStorage for future use
          await AsyncStorage.setItem('driverInfo', JSON.stringify(data));
          
          // Arbitrary rating logic
          const calculatedRating = Math.min(80, 100);
          setRating(calculatedRating);
          
          // Check if user already has a photo
          if (!data.photo) {
            checkFirstVisit();
          }
        } else {
          console.log("No driver data found in Firestore");
          checkFirstVisit();
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  const handleProfilePictureChange = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert("Error", "You must be logged in to change your profile picture.");
      return;
    }
    try {
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const imageUri = result.assets[0].uri;
        console.log("Selected image URI:", imageUri);
        
        try {
          // Create a reference to the storage location
          const filename = `${user.uid}_${Date.now()}.jpg`;
          const storageRef = ref(storage, `profile_photos/${filename}`);
          console.log("Storage reference created:", storageRef);
          
          // Convert URI to blob
          console.log("Fetching image...");
          const response = await fetch(imageUri);
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          }
          
          console.log("Converting to blob...");
          const blob = await response.blob();
          if (!blob) {
            throw new Error('Failed to convert image to blob');
          }
          console.log("Blob created successfully, size:", blob.size);
          
          // Upload the image with metadata
          console.log("Uploading to Firebase Storage...");
          const metadata = {
            contentType: 'image/jpeg',
            customMetadata: {
              'uploadedBy': user.uid,
              'uploadedAt': new Date().toISOString()
            }
          };
          
          const uploadResult = await uploadBytes(storageRef, blob, metadata);
          console.log("Upload result:", uploadResult);
          
          // Get the download URL
          console.log("Getting download URL...");
          const downloadURL = await getDownloadURL(uploadResult.ref);
          console.log("Download URL:", downloadURL);
          
          // Update Firestore with the download URL
          console.log("Updating Firestore...");
          const docRef = doc(db, "Drivers", user.uid);
          await updateDoc(docRef, { 
            photo: downloadURL,
            photoUpdatedAt: new Date().toISOString()
          });
          
          // Update local state and AsyncStorage
          const updatedDetails = { 
            ...userDetails, 
            photo: downloadURL,
            photoUpdatedAt: new Date().toISOString()
          };
          setUserDetails(updatedDetails);
          await AsyncStorage.setItem('driverInfo', JSON.stringify(updatedDetails));
          
          // Close prompt if open
          setShowPhotoPrompt(false);
          
          Alert.alert("Success", "Profile picture updated successfully.");
        } catch (uploadError) {
          console.error("Detailed upload error:", uploadError);
          console.error("Error code:", uploadError.code);
          console.error("Error message:", uploadError.message);
          console.error("Error details:", uploadError.details);
          
          Alert.alert(
            "Error", 
            `Failed to upload image: ${uploadError.message}. Please try again.`
          );
        }
      }
    } catch (error) {
      console.error("Detailed error:", error);
      Alert.alert(
        "Error", 
        `Unable to update profile picture: ${error.message}. Please try again.`
      );
    } finally {
      setLoading(false);
    }
  };

  const dismissPhotoPrompt = () => {
    setShowPhotoPrompt(false);
  };

  const PhotoPromptModal = () => (
    <Modal
      transparent={true}
      visible={showPhotoPrompt}
      animationType="fade"
      onRequestClose={dismissPhotoPrompt}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={["#ff7e28", "#ff9f43"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalHeader}
          >
            <Ionicons name="camera" size={32} color="#fff" />
          </LinearGradient>
          
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Télécharger une photo de profil</Text>
            <Text style={styles.modalMessage}>
              L'ajout d'une photo de profil professionnelle aide à établir la confiance avec les clients et améliore votre 
              vérification d'identité en tant que chauffeur Caval Courier.
            </Text>
            
            <View style={styles.benefitsContainer}>
              <View style={styles.benefitItem}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name="shield-checkmark-outline" size={22} color="#ff7e28" />
                </View>
                <Text style={styles.benefitText}>Vérification améliorée du chauffeur</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name="star-outline" size={22} color="#ff7e28" />
                </View>
                <Text style={styles.benefitText}>Meilleures évaluations des clients</Text>
              </View>
              
              <View style={styles.benefitItem}>
                <View style={styles.benefitIconContainer}>
                  <Ionicons name="person-outline" size={22} color="#ff7e28" />
                </View>
                <Text style={styles.benefitText}>Apparence professionnelle</Text>
              </View>
            </View>
            
            <View style={styles.modalButtonsContainer}>
              <TouchableOpacity 
                style={styles.uploadButton}
                onPress={handleProfilePictureChange}
              >
                <Ionicons name="image-outline" size={20} color="#fff" />
                <Text style={styles.uploadButtonText}>Choisir une photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.laterButton}
                onPress={dismissPhotoPrompt}
              >
                <Text style={styles.laterButtonText}>Je le ferai plus tard</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
  const handleLogin = async () => {
    try {
      // Set persistence first
      await setPersistence(auth, browserLocalPersistence);
      // Then sign in
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // The rest of your login code...
    } catch (error) {
      // Your error handling...
    }
  };

  // Modify your handleLogout function to clear AsyncStorage:
async function handleLogout() {
  try {
    // Clear user data from AsyncStorage
    await AsyncStorage.removeItem('driverInfo');
    await AsyncStorage.removeItem('hasVisitedProfile');
    
    // Sign out from Firebase
    await auth.signOut();
    
    // Navigate to login screen
    navigation.navigate("LoginScreen");
  } catch (error) {
    Alert.alert("Error", error.message, [{ text: "OK" }]);
  }
}

  const handleHelpPress = () => {
    Linking.openURL("https://www.caval.tech/contact");
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#ff7e28" />
      </View>
    );
  }

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[...Array(5)].map((_, index) => {
          const starValue = (index + 1) * 20;
          const isHalfStar = rating >= starValue - 10 && rating < starValue;
          const isFullStar = rating >= starValue;
          return (
            <Ionicons
              key={index}
              name={isHalfStar ? "star-half" : isFullStar ? "star" : "star-outline"}
              size={20}
              color="#FFC107"
              style={styles.starIcon}
            />
          );
        })}
        <Text style={styles.ratingText}>
          {Math.floor(rating / 20)}
          {rating % 20 >= 10 ? ".5" : ""}
        </Text>
      </View>
    );
  };

  const renderStatusBadge = () => {
    return (
      <View style={styles.statusBadgeContainer}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Actif</Text>
      </View>
    );
  };

  const renderDriverInfo = () => {
    return (
      <View style={styles.driverInfoContainer}>
        <View style={styles.driverInfoItem}>
          <Ionicons name="car" size={16} color={colors.primary} style={styles.driverInfoIcon} />
          <Text style={styles.driverInfoText}>Caval Courier</Text>
        </View>
        <View style={styles.driverInfoItem}>
          <Ionicons name="location" size={16} color={colors.primary} style={styles.driverInfoIcon} />
          <Text style={styles.driverInfoText}>
            {userDetails?.city || "Ville"}
          </Text>
        </View>
        <View style={styles.driverInfoItem}>
          <Ionicons name="call" size={16} color={colors.primary} style={styles.driverInfoIcon} />
          <Text style={styles.driverInfoText}>
            {userDetails?.phoneNumber || "Téléphone"}
          </Text>
        </View>
      </View>
    );
  };

  const renderMissingPhotoReminder = () => {
    if (userDetails?.photo) return null;
    
    return (
      <TouchableOpacity 
        style={styles.photoReminderBanner}
        onPress={handleProfilePictureChange}
      >
        <View style={styles.photoReminderIconContainer}>
          <Ionicons name="camera" size={20} color="#fff" />
        </View>
        <Text style={styles.photoReminderText}>
          Ajoutez une photo de profil pour compléter votre profil de chauffeur
        </Text>
        <Ionicons name="chevron-forward" size={20} color="#ff7e28" />
      </TouchableOpacity>
    );
  };

  const MenuItem = ({ icon, title, onPress, badge }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.menuItemLeft}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
          <Ionicons name={icon} size={22} color="#fff" />
        </View>
        <Text style={[styles.menuText, { color: colors.text }]}>{title}</Text>
      </View>
      {badge ? (
        <View style={[styles.badgeContainer, { backgroundColor: colors.error }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#ff7e28" />
      
      {/* Photo Upload Prompt Modal */}
      <PhotoPromptModal />
      
      {/* Logo Header */}
      <View style={[styles.logoHeader, { backgroundColor: colors.card }]}>
        <Image
          source={require("../assets/Caval_courrier_logo-removebg-preview.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header with Gradient */}
        <LinearGradient
          colors={["#ff7e28", "#ff9f43"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.profilePicContainer}
              onPress={handleProfilePictureChange}
              activeOpacity={0.8}
            >
              {userDetails?.photo ? (
                <Image source={{ uri: userDetails.photo }} style={styles.profilePic} />
              ) : (
                <View style={[styles.placeholderPic, { backgroundColor: colors.card }]}>
                  <Ionicons name="person" size={42} color={colors.primary} />
                </View>
              )}
              <View style={styles.editBadge}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
            
            {/* Driver status badge */}
            {renderStatusBadge()}
          </View>
        </LinearGradient>

        {/* Profile Info */}
        <View style={[styles.profileInfoContainer, { backgroundColor: colors.card }]}>
          <Text style={[styles.userName, { color: colors.text }]}>
            {userDetails?.firstName || ""} {userDetails?.lastName || ""}
          </Text>
          {renderStars()}
          {renderDriverInfo()}
        </View>

        {/* Missing Photo Reminder if needed */}
        {renderMissingPhotoReminder()}

        
        {/* Menu Sections */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Compte</Text>
          <MenuItem
            icon="cash-outline"
            title="Gains"
            onPress={() => navigation.navigate("EarningsScreen")}
          />
          <MenuItem
            icon="help-circle-outline"
            title="Support"
            onPress={handleHelpPress}
          />
        </View>

        <View style={styles.menuSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Préférences</Text>
          <MenuItem
            icon="settings-outline"
            title="Paramètres"
            onPress={() => navigation.navigate("SettingsScreen")}
          />
          <MenuItem
            icon="shield-outline"
            title="Confidentialité et sécurité"
            onPress={() => Linking.openURL('https://www.caval.tech/privacy-policy')}
          />
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: colors.error }]}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={22} color="#fff" />
          <Text style={styles.logoutButtonText}>déconnexion</Text>
        </TouchableOpacity>

        <View style={styles.versionContainer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>
            version 1.2.3
          </Text>
          <Text style={[styles.copyrightText, { color: colors.textSecondary }]}>
            © 2025 Caval Technologies
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default Profile;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  logoHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  logo: {
    width: 120,
    height: 40,
  },
  container: {
    flexGrow: 1,
    paddingBottom: 30,
  },
  headerGradient: {
    paddingTop: 20,
    paddingBottom: 65,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    alignItems: "center",
  },
  profilePicContainer: {
    position: "relative",
    marginBottom: 10,
  },
  profilePic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: "#fff",
  },
  placeholderPic: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ff7e28",
    padding: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: "#fff",
  },
  statusBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#4CAF50",
    marginRight: 6,
  },
  statusText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  profileInfoContainer: {
    alignItems: "center",
    marginTop: -30,
    backgroundColor: "#fff",
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  ratingText: {
    fontSize: 16,
    color: "#666",
    fontWeight: "600",
    marginLeft: 5,
  },
  driverInfoContainer: {
    width: "100%",
    marginTop: 10,
    marginBottom: 5,
  },
  driverInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  driverInfoIcon: {
    marginRight: 6,
  },
  driverInfoText: {
    fontSize: 14,
    color: "#666",
  },
  menuSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
    marginLeft: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  menuText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  badgeContainer: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 14,
    marginHorizontal: 20,
    shadowColor: "#ff7e28",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  versionContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  versionText: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: "#999",
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  
  // New styles for photo reminder banner
  photoReminderBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF5EC",
    marginHorizontal: 20,
    marginVertical: 10,
    padding: 12,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#ff7e28",
  },
  photoReminderIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ff7e28",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  photoReminderText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: "90%",
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  modalMessage: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  benefitsContainer: {
    marginBottom: 24,
  },
  benefitItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  benefitIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF5EC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  benefitText: {
    fontSize: 15,
    color: "#444",
  },
  modalButtonsContainer: {
    alignItems: "center",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ff7e28",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 10,
  },
  laterButton: {
    paddingVertical: 12,
  },
  laterButtonText: {
    color: "#666",
    fontSize: 14,
  },
});