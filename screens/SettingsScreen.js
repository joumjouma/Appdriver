import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  SafeAreaView,
  Switch,
  Image,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import * as ImagePicker from "expo-image-picker";

function SettingsScreen() {
  const { colors, toggleTheme, isDarkMode } = useTheme();
  const navigation = useNavigation();
  const auth = getAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  // We still track these if you need them for any other purpose.
  // They are no longer displayed in a separate box.
  const [todayOnlineTime, setTodayOnlineTime] = useState("0h 0m");
  const [rating, setRating] = useState(80);
  const [rideCount, setRideCount] = useState(0);

  // Animation for header
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 50],
    outputRange: [1, 0.9],
    extrapolate: "clamp",
  });

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  // Format time in hours and minutes
  const formatTime = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.floor(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  useEffect(() => {
    const fetchUserDetails = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        // Fetch online time (similar to ProfileScreen)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const statsDocRef = doc(db, "driverStats", currentUser.uid);
        const statsDocSnap = await getDoc(statsDocRef);

        if (statsDocSnap.exists()) {
          const stats = statsDocSnap.data();
          const todayStats = stats.dailyStats?.find(
            (stat) => stat.date.toDate().toDateString() === today.toDateString()
          );

          if (todayStats) {
            setTodayOnlineTime(formatTime(todayStats.onlineTime));
          }
        }

        // Fetch driver details
        const docRefDriver = doc(db, "Drivers", currentUser.uid);
        const docSnapDriver = await getDoc(docRefDriver);

        if (docSnapDriver.exists()) {
          setUserDetails(docSnapDriver.data());
          setRating(Math.min(docSnapDriver.data().rating || 80, 100));
          setRideCount(docSnapDriver.data().rideCount || 0);
        }
      } catch (error) {
        console.error("Error fetching user details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  const handleReferralPress = () => {
    Linking.openURL("https://www.caval.tech/contact");
  };

  const handlePrivacyPolicyPress = () => {
    Linking.openURL("https://www.caval.tech/privacy-policy");
  };

  const handleSupportPress = () => {
    Linking.openURL("https://www.caval.tech/support");
  };

  const handleProfilePictureChange = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert(
        "Error",
        "You must be logged in to change your profile picture."
      );
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

  async function handleLogout() {
    try {
      await auth.signOut();
      navigation.navigate("LoginScreen");
    } catch (error) {
      Alert.alert("Error", error.message, [{ text: "OK" }]);
    }
  }

  // Renders the star rating beneath the driver's name
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
              name={
                isHalfStar
                  ? "star-half"
                  : isFullStar
                  ? "star"
                  : "star-outline"
              }
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#ff7e28" />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Enhanced header with animation */}
      <Animated.View
        style={[
          styles.headerContainer,
          {
            backgroundColor: colors.background,
            shadowColor: colors.text,
            opacity: headerOpacity,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <TouchableOpacity style={styles.helpButton}>
          <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </Animated.View>

      {/* Profile section at the top */}
      <View style={[styles.profileSection, { backgroundColor: colors.card }]}>
        <View style={styles.profileImageContainer}>
          {userDetails?.photo ? (
            <Image source={{ uri: userDetails.photo }} style={styles.profileImage} />
          ) : (
            <View style={[styles.placeholderPic, { backgroundColor: colors.primary }]}>
              <Ionicons name="person" size={30} color="#FFFFFF" />
            </View>
          )}
          <TouchableOpacity
            style={[styles.editIconContainer, { backgroundColor: colors.primary }]}
            onPress={handleProfilePictureChange}
          >
            <Ionicons name="pencil" size={14} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {userDetails?.firstName || ""} {userDetails?.lastName || ""}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {userDetails?.email || "driver@example.com"}
          </Text>
          {renderStars()}
          <TouchableOpacity
            style={[styles.editProfileButton, { backgroundColor: colors.primaryLight }]}
            onPress={() => navigation.navigate("EditProfile")}
          >
            <Text style={[styles.editProfileText, { color: colors.primary }]}>
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 
        Removed the entire Driver Stats Section here as requested:
        (Online Today, Rides, Ratings box)
      */}

      {/* Main scrollable area */}
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.content}>
          {/* Account Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Account Settings
            </Text>

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => navigation.navigate("ModifyInfo")}
            >
              <View style={styles.settingItemLeft}>
                <Ionicons name="person-outline" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Personal Information
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Update your profile details
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.settingItem} 
              onPress={() => navigation.navigate("PaymentScreen")}
            >
              <View style={styles.settingItemLeft}>
                <Ionicons name="wallet-outline" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Payment Methods
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Manage payment options
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Theme & Appearance Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Theme & Appearance
            </Text>

            <TouchableOpacity style={styles.settingItem} onPress={toggleTheme}>
              <View style={styles.settingItemLeft}>
                <Ionicons
                  name={isDarkMode ? "moon" : "sunny"}
                  size={24}
                  color={colors.primary}
                />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Dark Mode
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Toggle dark/light theme
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: "#767577", true: colors.primaryLight }}
                thumbColor={isDarkMode ? colors.primary : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={toggleTheme}
                value={isDarkMode}
              />
            </TouchableOpacity>
          </View>

          {/* Security Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Security
            </Text>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="finger-print" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Biometric Authentication
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Use fingerprint or Face ID
                  </Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: "#767577", true: colors.primaryLight }}
                thumbColor={biometricsEnabled ? colors.primary : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={() => setBiometricsEnabled((prev) => !prev)}
                value={biometricsEnabled}
              />
            </TouchableOpacity>
          </View>

          {/* Referral Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Rewards</Text>

            <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="gift" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Refer a Friend
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Get 3500 FDJ for each referral
                  </Text>
                </View>
              </View>
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={styles.badgeText}>NEW</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Support Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Help & Support
            </Text>

            <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="help-circle-outline" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Help Center
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Get help and support
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <View style={styles.settingItemLeft}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={24}
                  color={colors.primary}
                />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Contact Us
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Get in touch with support
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Legal Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              About
            </Text>

            <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <View style={styles.settingItemLeft}>
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color={colors.primary}
                />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    About Caval
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Learn more about our app
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Terms of Service
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Read our terms of service
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.settingItem} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <View style={styles.settingItemLeft}>
                <Ionicons name="shield-outline" size={24} color={colors.primary} />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    Privacy Policy
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    Read our privacy policy
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* About/App info section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              About
            </Text>

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Ionicons
                  name="information-circle-outline"
                  size={24}
                  color={colors.primary}
                />
                <View>
                  <Text style={[styles.settingText, { color: colors.text }]}>
                    App Info
                  </Text>
                  <Text style={[styles.settingSubtext, { color: colors.textSecondary }]}>
                    version 2.1.4
                  </Text>
                </View>
              </View>
              <View style={[styles.updateBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.updateBadgeText}>Update Available</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Logout section */}
          <TouchableOpacity
            style={[styles.logoutButton, { backgroundColor: colors.errorLight }]}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
          </TouchableOpacity>

          <Text style={[styles.footerText, { color: colors.textSecondary }]}>
            © 2025 Caval Technologies Inc.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default SettingsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  helpButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  profileSection: {
    flexDirection: "row",
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  profileImageContainer: {
    position: "relative",
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  placeholderPic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  editIconContainer: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    marginBottom: 8,
  },
  starsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 14,
    color: "#666",
    fontWeight: "600",
    marginLeft: 4,
  },
  editProfileButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: "600",
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    padding: 16,
    paddingBottom: 8,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.05)",
  },
  settingItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingText: {
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  settingSubtext: {
    fontSize: 13,
    marginLeft: 12,
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  updateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  updateBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    marginTop: 12,
  },
  logoutText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: "600",
  },
  footerText: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 12,
  },
});
