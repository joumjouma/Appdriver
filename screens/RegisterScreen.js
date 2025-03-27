import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { auth, db, storage } from "./firebase";
import { setDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";
import CavalLogo from "../assets/vgae.png";
import { Camera} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fname, setFname] = useState("");
  const [lname, setLname] = useState("");
  const [phone, setPhone] = useState("");
  const [driverType, setDriverType] = useState("Caval Privé");
  const [profileImage, setProfileImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);

  const navigation = useNavigation();

  // Request camera permissions
  const requestCameraPermission = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    setHasCameraPermission(status === "granted");
    if (status === "granted") {
      setShowCamera(true);
    } else {
      Alert.alert(
        "Camera Permission",
        "We need camera permission to take your profile photo"
      );
    }
  };

  // Take picture
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.7,
          exif: false,
        });
        setProfileImage(photo.uri);
        setShowCamera(false);
      } catch (error) {
        console.log("Error taking picture:", error);
        Alert.alert("Error", "Failed to take picture. Please try again.");
      }
    }
  };

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        setProfileImage(result.assets[0].uri);
      }
    } catch (error) {
      console.log("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  // Upload image to Firebase Storage
  const uploadImage = async (uid) => {
    if (!profileImage) return null;

    try {
      const response = await fetch(profileImage);
      const blob = await response.blob();
      
      const imageRef = ref(storage, `driverProfiles/${uid}`);
      await uploadBytes(imageRef, blob);
      
      const downloadURL = await getDownloadURL(imageRef);
      return downloadURL;
    } catch (error) {
      console.log("Error uploading image:", error);
      throw new Error("Failed to upload profile image. Please try again.");
    }
  };

  const handleRegister = async () => {
    if (!email || !password || !fname || !lname || !phone) {
      Alert.alert("Missing Information", "Please fill in all required fields", [{ text: "OK" }]);
      return;
    }

    if (!profileImage) {
      Alert.alert("Profile Photo Required", "Please take or upload your profile photo. This cannot be changed later.", [
        { text: "OK" }
      ]);
      return;
    }

    setIsLoading(true);

    try {
      // Create the user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const user = userCredential.user;

      // Upload profile image to Firebase Storage
      const imageUrl = await uploadImage(user.uid);

      // Save all user info to the "Drivers" collection in Firestore
      await setDoc(doc(db, "Drivers", user.uid), {
        email: user.email,
        firstName: fname,
        lastName: lname,
        phoneNumber: phone,
        driverType: driverType,
        profileImageUrl: imageUrl,
        profileImageLocked: true, // This indicates the image cannot be changed
        createdAt: new Date(),
        accountStatus: "pending",
      });

      // Sign out the user so they have to log in manually
      await signOut(auth);

      setIsLoading(false);
      Alert.alert(
        "Registration Successful",
        "Your account has been created successfully! Please log in.",
        [{ text: "OK", onPress: () => navigation.navigate("LoginScreen") }]
      );
    } catch (error) {
      setIsLoading(false);
      console.log(error.message);
      Alert.alert("Registration Failed", error.message, [{ text: "OK" }]);
    }
  };

  // Camera view
  if (showCamera) {
    return (
      <View style={styles.cameraContainer}>
        <Camera style={styles.camera} type="front" ref={cameraRef}>
          <View style={styles.cameraControls}>
            <TouchableOpacity style={styles.backButton} onPress={() => setShowCamera(false)}>
              <Ionicons name="arrow-back" size={28} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
          <View style={styles.cameraOverlay}>
            <View style={styles.cameraOverlayCircle} />
          </View>
        </Camera>
      </View>
    );
  }

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      <LinearGradient
        colors={['#ff9f43', '#ff7e28']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Image source={CavalLogo} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.headerTitle}>Driver Registration</Text>
      </LinearGradient>
      
      <ScrollView
        contentContainerStyle={styles.container}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <Text style={styles.title}>Create Your Driver Account</Text>
          <Text style={styles.subtitle}>
            Join the Caval team and start earning today
          </Text>

          {/* Profile Image */}
          <View style={styles.profileImageContainer}>
            <Text style={styles.profileImageTitle}>Driver Profile Photo</Text>
            <Text style={styles.profileImageSubtitle}>
              This photo cannot be changed after registration
            </Text>
            
            {profileImage ? (
              <View style={styles.profileImageWrapper}>
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
                <TouchableOpacity 
                  style={styles.retakeButton}
                  onPress={requestCameraPermission}
                >
                  <MaterialIcons name="replay" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.imageOptionContainer}>
                <TouchableOpacity 
                  style={styles.imageOptionButton}
                  onPress={requestCameraPermission}
                >
                  <Ionicons name="camera" size={28} color="#ff9f43" />
                  <Text style={styles.imageOptionText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.imageOptionButton}
                  onPress={pickImage}
                >
                  <Ionicons name="image" size={28} color="#ff9f43" />
                  <Text style={styles.imageOptionText}>Upload Photo</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Driver Type Selection */}
          <View style={styles.driverTypeContainer}>
            <Text style={styles.label}>Select Driver Type</Text>
            <View style={styles.buttonGroup}>
              {["Caval Privé", "Caval Taxi", "Caval moto"].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.typeButton,
                    driverType === type && styles.selectedButton,
                  ]}
                  onPress={() => setDriverType(type)}
                >
                  <Text
                    style={[
                      styles.typeButtonText,
                      driverType === type && styles.selectedButtonText,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.formContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Personal Information</Text>
              
              <View style={styles.inputRow}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter first name"
                      onChangeText={setFname}
                      value={fname}
                    />
                  </View>
                </View>
                
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter last name"
                      onChangeText={setLname}
                      value={lname}
                    />
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Contact Details</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    onChangeText={setEmail}
                    value={email}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your phone number"
                    onChangeText={setPhone}
                    value={phone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security</Text>
              
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Create a secure password"
                    onChangeText={setPassword}
                    value={password}
                    secureTextEntry={true}
                  />
                </View>
                <Text style={styles.passwordHint}>
                  Password must be at least 8 characters
                </Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.button} 
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.buttonText}>Create Driver Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              onPress={() => navigation.navigate("LoginScreen")}
              style={styles.linkContainer}
            >
              <Text style={styles.linkText}>
                Already have an account?{" "}
                <Text style={styles.link}>Sign In</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
      
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          By creating an account, you agree to our Terms & Conditions and Privacy Policy
        </Text>
      </View>
    </View>
  );
}

export default RegisterScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f7f9fc",
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 10,
  },
  keyboardAvoidingView: {
    flex: 1,
    width: "100%",
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
    color: "#333",
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  profileImageContainer: {
    alignItems: "center",
    marginBottom: 25,
  },
  profileImageTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 4,
  },
  profileImageSubtitle: {
    fontSize: 13,
    color: "#ff5252",
    marginBottom: 15,
    fontStyle: "italic",
  },
  profileImageWrapper: {
    position: "relative",
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: "#ff9f43",
  },
  retakeButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ff9f43",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 3,
  },
  imageOptionContainer: {
    flexDirection: "row",
    justifyContent: "center",
    width: "100%",
  },
  imageOptionButton: {
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginHorizontal: 10,
    width: 130,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  imageOptionText: {
    marginTop: 8,
    color: "#333",
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 15,
    padding: 20,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 15,
  },
  formContainer: {
    width: "100%",
    marginTop: 5,
  },
  driverTypeContainer: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    marginBottom: 10,
    color: "#333",
    fontWeight: "500",
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  typeButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#ff9f43",
    borderRadius: 12,
    marginHorizontal: 4,
    alignItems: "center",
    backgroundColor: "white",
    shadowColor: "#ff9f43",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 1,
  },
  selectedButton: {
    backgroundColor: "#ff9f43",
  },
  typeButtonText: {
    fontSize: 14,
    color: "#ff9f43",
    fontWeight: "600",
  },
  selectedButtonText: {
    color: "#fff",
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  halfWidth: {
    width: "48%",
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    color: "#333",
    marginBottom: 6,
    fontWeight: "500",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 50,
    backgroundColor: "#f8f8f8",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  inputIcon: {
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: "#333",
  },
  passwordHint: {
    fontSize: 12,
    color: "#777",
    marginTop: 4,
    fontStyle: "italic",
  },
  button: {
    backgroundColor: "#ff9f43",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: "#ff9f43",
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#e0e0e0",
  },
  dividerText: {
    paddingHorizontal: 15,
    color: "#666",
  },
  linkContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  linkText: {
    color: "#333",
    fontSize: 16,
  },
  link: {
    color: "#ff9f43",
    fontWeight: "600",
  },
  footer: {
    padding: 15,
    backgroundColor: "#f8f8f8",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  footerText: {
    textAlign: "center",
    fontSize: 12,
    color: "#777",
  },
  cameraContainer: {
    flex: 1,
    justifyContent: "center",
  },
  camera: {
    flex: 1,
    justifyContent: "flex-end",
  },
  cameraControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingBottom: 40,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraOverlayCircle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
    borderStyle: 'dashed',
  },
});