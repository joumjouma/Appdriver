import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  SafeAreaView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useTheme } from "../context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { getAuth, updateEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

function ModifyInfo() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const auth = getAuth();
  const user = auth.currentUser;

  // User information states
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [drivingLicense, setDrivingLicense] = useState("");
  const [address, setAddress] = useState("");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [secureEntry, setSecureEntry] = useState(true);
  const [secureEntryNew, setSecureEntryNew] = useState(true);
  const [secureEntryConfirm, setSecureEntryConfirm] = useState(true);
  const [editMode, setEditMode] = useState({
    personalInfo: false,
    contactInfo: false,
    password: false,
    drivingInfo: false,
  });

  // Fetch user data on component mount
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        navigation.navigate("LoginScreen");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "Drivers", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setFirstName(userData.firstName || "");
          setLastName(userData.lastName || "");
          setEmail(user.email || "");
          setPhone(userData.phoneNumber || "");
          setDrivingLicense(userData.drivingLicense || "");
          setAddress(userData.address || "");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        Alert.alert("Error", "Failed to load your information. Please try again.");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Function to toggle edit mode for different sections
  const toggleEditMode = (section) => {
    setEditMode((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));

    // Reset password fields when cancelling password edit
    if (section === "password" && editMode.password) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  // Function to validate email format
  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Function to validate phone number format
  const isValidPhone = (phone) => {
    const phoneRegex = /^\+?[0-9]{10,15}$/;
    return phoneRegex.test(phone);
  };

  // Function to handle personal info update
  const handlePersonalInfoUpdate = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Error", "First name and last name cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "Drivers", user.uid), {
        firstName,
        lastName,
      });
      
      Alert.alert("Success", "Personal information updated successfully.");
      setEditMode((prev) => ({ ...prev, personalInfo: false }));
    } catch (error) {
      console.error("Error updating personal info:", error);
      Alert.alert("Error", "Failed to update personal information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle contact info update
  const handleContactInfoUpdate = async () => {
    if (!isValidEmail(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    if (!isValidPhone(phone)) {
      Alert.alert("Error", "Please enter a valid phone number (10-15 digits).");
      return;
    }

    setLoading(true);
    try {
      // Update email requires re-authentication
      if (email !== user.email) {
        Alert.alert(
          "Authentication Required",
          "To update your email, please enter your current password:",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Confirm",
              onPress: async (password) => {
                if (!password) {
                  Alert.alert("Error", "Password is required to update email.");
                  setLoading(false);
                  return;
                }
                
                try {
                  const credential = EmailAuthProvider.credential(user.email, password);
                  await reauthenticateWithCredential(user, credential);
                  await updateEmail(user, email);
                  
                  await updateDoc(doc(db, "Drivers", user.uid), {
                    email,
                    phoneNumber: phone,
                  });
                  
                  Alert.alert("Success", "Contact information updated successfully.");
                  setEditMode((prev) => ({ ...prev, contactInfo: false }));
                } catch (error) {
                  console.error("Error updating email:", error);
                  Alert.alert("Error", "Failed to update email. Please check your password and try again.");
                } finally {
                  setLoading(false);
                }
              },
              style: "default",
            },
          ],
          { 
            cancelable: true,
            prompt: true,
            type: "secure-text",
          }
        );
      } else {
        // Just update phone number
        await updateDoc(doc(db, "Drivers", user.uid), {
          phoneNumber: phone,
        });
        
        Alert.alert("Success", "Contact information updated successfully.");
        setEditMode((prev) => ({ ...prev, contactInfo: false }));
        setLoading(false);
      }
    } catch (error) {
      console.error("Error updating contact info:", error);
      Alert.alert("Error", "Failed to update contact information. Please try again.");
      setLoading(false);
    }
  };

  // Function to handle password update
  const handlePasswordUpdate = async () => {
    if (!currentPassword) {
      Alert.alert("Error", "Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Error", "New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Error", "New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate user before changing password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Update password
      await updatePassword(user, newPassword);
      
      Alert.alert("Success", "Password updated successfully.");
      setEditMode((prev) => ({ ...prev, password: false }));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Error updating password:", error);
      Alert.alert("Error", "Failed to update password. Please check your current password and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle driving info update
  const handleDrivingInfoUpdate = async () => {
    if (!drivingLicense.trim()) {
      Alert.alert("Error", "Driving license number cannot be empty.");
      return;
    }

    if (!address.trim()) {
      Alert.alert("Error", "Address cannot be empty.");
      return;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, "Drivers", user.uid), {
        drivingLicense,
        address,
      });
      
      Alert.alert("Success", "Driving information updated successfully.");
      setEditMode((prev) => ({ ...prev, drivingInfo: false }));
    } catch (error) {
      console.error("Error updating driving info:", error);
      Alert.alert("Error", "Failed to update driving information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Personal Information
        </Text>
        <View style={styles.placeholder} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView style={styles.scrollView}>
          {/* Personal Info Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Personal Information
              </Text>
              <TouchableOpacity
                onPress={() => toggleEditMode("personalInfo")}
                style={styles.editButton}
              >
                <Text style={[styles.editButtonText, { color: colors.primary }]}>
                  {editMode.personalInfo ? "Cancel" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                First Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: editMode.personalInfo
                      ? colors.inputBackground
                      : "transparent",
                    color: colors.text,
                    borderColor: editMode.personalInfo
                      ? colors.primary
                      : "transparent",
                  },
                ]}
                value={firstName}
                onChangeText={setFirstName}
                editable={editMode.personalInfo}
                placeholder="Enter first name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.infoContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Last Name
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: editMode.personalInfo
                      ? colors.inputBackground
                      : "transparent",
                    color: colors.text,
                    borderColor: editMode.personalInfo
                      ? colors.primary
                      : "transparent",
                  },
                ]}
                value={lastName}
                onChangeText={setLastName}
                editable={editMode.personalInfo}
                placeholder="Enter last name"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            {editMode.personalInfo && (
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handlePersonalInfoUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Contact Info Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Contact Information
              </Text>
              <TouchableOpacity
                onPress={() => toggleEditMode("contactInfo")}
                style={styles.editButton}
              >
                <Text style={[styles.editButtonText, { color: colors.primary }]}>
                  {editMode.contactInfo ? "Cancel" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Email
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: editMode.contactInfo
                      ? colors.inputBackground
                      : "transparent",
                    color: colors.text,
                    borderColor: editMode.contactInfo
                      ? colors.primary
                      : "transparent",
                  },
                ]}
                value={email}
                onChangeText={setEmail}
                editable={editMode.contactInfo}
                placeholder="Enter email"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.infoContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Phone Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: editMode.contactInfo
                      ? colors.inputBackground
                      : "transparent",
                    color: colors.text,
                    borderColor: editMode.contactInfo
                      ? colors.primary
                      : "transparent",
                  },
                ]}
                value={phone}
                onChangeText={setPhone}
                editable={editMode.contactInfo}
                placeholder="Enter phone number"
                placeholderTextColor={colors.textSecondary}
                keyboardType="phone-pad"
              />
            </View>

            {editMode.contactInfo && (
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleContactInfoUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Password Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Password
              </Text>
              <TouchableOpacity
                onPress={() => toggleEditMode("password")}
                style={styles.editButton}
              >
                <Text style={[styles.editButtonText, { color: colors.primary }]}>
                  {editMode.password ? "Cancel" : "Change"}
                </Text>
              </TouchableOpacity>
            </View>

            {editMode.password ? (
              <>
                <View style={styles.infoContainer}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Current Password
                  </Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[
                        styles.passwordInput,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                        },
                      ]}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={secureEntry}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setSecureEntry(!secureEntry)}
                    >
                      <Ionicons
                        name={secureEntry ? "eye-off" : "eye"}
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.infoContainer}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    New Password
                  </Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[
                        styles.passwordInput,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                        },
                      ]}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Enter new password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={secureEntryNew}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setSecureEntryNew(!secureEntryNew)}
                    >
                      <Ionicons
                        name={secureEntryNew ? "eye-off" : "eye"}
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.infoContainer}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>
                    Confirm New Password
                  </Text>
                  <View style={styles.passwordContainer}>
                    <TextInput
                      style={[
                        styles.passwordInput,
                        {
                          backgroundColor: colors.inputBackground,
                          color: colors.text,
                        },
                      ]}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Confirm new password"
                      placeholderTextColor={colors.textSecondary}
                      secureTextEntry={secureEntryConfirm}
                    />
                    <TouchableOpacity
                      style={styles.eyeIcon}
                      onPress={() => setSecureEntryConfirm(!secureEntryConfirm)}
                    >
                      <Ionicons
                        name={secureEntryConfirm ? "eye-off" : "eye"}
                        size={24}
                        color={colors.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.passwordRequirements, { color: colors.textSecondary }]}>
                  Password must be at least 8 characters long and include a mix of letters, numbers, and special characters.
                </Text>

                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handlePasswordUpdate}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.passwordPlaceholder}>
                <Text style={[styles.passwordPlaceholderText, { color: colors.textSecondary }]}>
                  ••••••••••
                </Text>
                <Text style={[styles.passwordLastChanged, { color: colors.textSecondary }]}>
                  For security reasons, password is hidden
                </Text>
              </View>
            )}
          </View>

          {/* Driving Info Section */}
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Driver Information
              </Text>
              <TouchableOpacity
                onPress={() => toggleEditMode("drivingInfo")}
                style={styles.editButton}
              >
                <Text style={[styles.editButtonText, { color: colors.primary }]}>
                  {editMode.drivingInfo ? "Cancel" : "Edit"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Driving License Number
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: editMode.drivingInfo
                      ? colors.inputBackground
                      : "transparent",
                    color: colors.text,
                    borderColor: editMode.drivingInfo
                      ? colors.primary
                      : "transparent",
                  },
                ]}
                value={drivingLicense}
                onChangeText={setDrivingLicense}
                editable={editMode.drivingInfo}
                placeholder="Enter driving license number"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.infoContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                Address
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: editMode.drivingInfo
                      ? colors.inputBackground
                      : "transparent",
                    color: colors.text,
                    borderColor: editMode.drivingInfo
                      ? colors.primary
                      : "transparent",
                    minHeight: 60,
                  },
                ]}
                value={address}
                onChangeText={setAddress}
                editable={editMode.drivingInfo}
                placeholder="Enter address"
                placeholderTextColor={colors.textSecondary}
                multiline={true}
              />
            </View>

            {editMode.drivingInfo && (
              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleDrivingInfoUpdate}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Security notice */}
          <View style={[styles.securityNotice, { backgroundColor: colors.cardSecondary }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
            <Text style={[styles.securityText, { color: colors.textSecondary }]}>
              Your personal information is encrypted and protected. We never share your details with third parties.
            </Text>
          </View>

          {/* Bottom padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  placeholder: {
    width: 40,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    margin: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  editButton: {
    padding: 8,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  infoContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  eyeIcon: {
    padding: 12,
  },
  passwordRequirements: {
    fontSize: 12,
    marginTop: -8,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  passwordPlaceholder: {
    paddingVertical: 12,
  },
  passwordPlaceholderText: {
    fontSize: 18,
    letterSpacing: 2,
  },
  passwordLastChanged: {
    fontSize: 12,
    marginTop: 4,
  },
  saveButton: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  securityNotice: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  securityText: {
    flex: 1,
    marginLeft: 16,
    fontSize: 14,
  },
  bottomPadding: {
    height: 40,
  },
});

export default ModifyInfo;