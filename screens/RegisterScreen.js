import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Image,
} from "react-native";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import CavalLogo from "../assets/Caval_courrier_logo-removebg-preview.png";
import { useTheme } from "../context/ThemeContext";
import { APP_CONFIG } from "../constants/appConfig";

function RegisterScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [prenom, setPrenom] = useState("");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [typeDeVehicule, setTypeDeVehicule] = useState("Caval Privé");
  const [isLoading, setIsLoading] = useState(false);
  const [ville, setVille] = useState("");
  const [pays, setPays] = useState("");

  const navigation = useNavigation();

  const formatPhoneNumber = (text) => {
    // Remove any non-digit characters
    const cleaned = text.replace(/\D/g, '');
    
    // If the number starts with 253, remove it as we'll add it back
    let number = cleaned;
    if (number.startsWith('253')) {
      number = number.substring(3);
    }
    
    // Limit to 8 digits (Djibouti numbers are typically 8 digits after country code)
    number = number.substring(0, 8);
    
    // Format the number with spaces
    let formatted = '';
    for (let i = 0; i < number.length; i++) {
      if (i === 2 || i === 4) {
        formatted += ' ';
      }
      formatted += number[i];
    }
    
    return formatted;
  };

  const handlePhoneChange = (text) => {
    const formatted = formatPhoneNumber(text);
    setTelephone(formatted);
  };

  const handleRegister = async () => {
    if (!email || !password || !prenom || !nom || !telephone) {
      Alert.alert(
        "Informations manquantes",
        "Veuillez remplir tous les champs obligatoires",
        [{ text: "OK" }]
      );
      return;
    }

    setIsLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(
        getAuth(),
        email,
        password
      );
      const user = userCredential.user;

      // Enregistrer l'UID du chauffeur dans AsyncStorage
      try {
        await AsyncStorage.setItem('driverUID', user.uid);
      } catch (e) {
        console.log("Erreur lors de l'enregistrement de l'UID dans AsyncStorage:", e);
      }

      // Enregistrer les informations utilisateur dans Firestore
      const driverData = {
        email: user.email,
        firstName: prenom,
        lastName: nom,
        phoneNumber: telephone,
        vehicleType: typeDeVehicule,
        city: ville,
        country: pays,
        rating: 0,
        rideCount: 0,
        onlineTime: 0,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
        earnings: 0,
        totalEarnings: 0,
        weeklyEarnings: 0,
        dailyEarnings: 0,
        lastOnline: new Date(),
        isOnline: false,
        driverType: typeDeVehicule,
      };

      try {
        await setDoc(doc(db, "Drivers", user.uid), driverData);
      } catch (firestoreError) {
        await user.delete();
        throw firestoreError;
      }

      await AsyncStorage.setItem('driverInfo', JSON.stringify(driverData));
      await signOut(getAuth());

      setIsLoading(false);
      Alert.alert(
        "Inscription réussie",
        "Votre compte a été créé avec succès ! Veuillez vous connecter.",
        [{ text: "OK", onPress: () => navigation.navigate("LoginScreen") }]
      );
    } catch (error) {
      setIsLoading(false);
      console.log("Registration error:", error);
      Alert.alert(
        "Échec de l'inscription", 
        error.message || "Une erreur est survenue lors de l'inscription. Veuillez réessayer.",
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <LinearGradient
        colors={["#121212", "#1F1F1F"]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.logoContainer}>
          <Image 
            source={CavalLogo} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
        >
          <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Créer un compte chauffeur</Text>
              <Text style={styles.subtitle}>
                Rejoignez l'équipe Caval et commencez à gagner dès aujourd'hui
              </Text>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Type de véhicule</Text>
                <View style={styles.buttonGroup}>
                  {[
                    "Caval Privé",
                    `${APP_CONFIG.displayName} moto`
                  ].map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.typeButton,
                        typeDeVehicule === type && styles.selectedButton,
                      ]}
                      onPress={() => setTypeDeVehicule(type)}
                    >
                      <Text
                        style={[
                          styles.typeButtonText,
                          typeDeVehicule === type && styles.selectedButtonText,
                        ]}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Informations personnelles</Text>
                <View style={styles.inputRow}>
                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>Prénom</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#a0a0a0"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Entrez votre prénom"
                        placeholderTextColor="#757575"
                        onChangeText={setPrenom}
                        value={prenom}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>Nom</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#a0a0a0"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Entrez votre nom"
                        placeholderTextColor="#757575"
                        onChangeText={setNom}
                        value={nom}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="mail-outline"
                      size={20}
                      color="#a0a0a0"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Entrez votre email"
                      placeholderTextColor="#757575"
                      onChangeText={setEmail}
                      value={email}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Téléphone</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="call-outline"
                      size={20}
                      color="#a0a0a0"
                      style={styles.inputIcon}
                    />
                    <Text style={styles.countryCode}>+253</Text>
                    <TextInput
                      style={[styles.input, styles.phoneInput]}
                      placeholder="XX XX XX XX"
                      placeholderTextColor="#757575"
                      onChangeText={handlePhoneChange}
                      value={telephone}
                      keyboardType="phone-pad"
                      maxLength={11} // 8 digits + 2 spaces
                    />
                  </View>
                </View>

                <View style={styles.inputRow}>
                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>Ville</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color="#a0a0a0"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Votre ville"
                        placeholderTextColor="#757575"
                        onChangeText={setVille}
                        value={ville}
                      />
                    </View>
                  </View>

                  <View style={[styles.inputContainer, styles.halfWidth]}>
                    <Text style={styles.inputLabel}>Pays</Text>
                    <View style={styles.inputWrapper}>
                      <Ionicons
                        name="earth-outline"
                        size={20}
                        color="#a0a0a0"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Votre pays"
                        placeholderTextColor="#757575"
                        onChangeText={setPays}
                        value={pays}
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.inputLabel}>Mot de passe</Text>
                  <View style={styles.inputWrapper}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={20}
                      color="#a0a0a0"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Créez un mot de passe"
                      placeholderTextColor="#757575"
                      onChangeText={setPassword}
                      value={password}
                      secureTextEntry
                    />
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleRegister}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.buttonContent}>
                    <Text style={styles.buttonText}>Créer un compte</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate("LoginScreen")}
              >
                <Text style={styles.loginText}>
                  Vous avez déjà un compte ?{" "}
                  <Text style={styles.loginLinkText}>Se connecter</Text>
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
}

export default RegisterScreen;

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#121212",
  },
  gradient: {
    flex: 1,
  },
  logoContainer: {
    paddingTop: 40,
    paddingLeft: 20,
    paddingBottom: 10,
  },
  logo: {
    width: 120,
    height: 40,
  },
  container: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 40,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  header: {
    marginBottom: 30,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.7)",
    letterSpacing: 0.3,
  },
  formContainer: {
    flex: 1,
  },
  card: {
    backgroundColor: "#252525",
    borderRadius: 16,
    padding: 22,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 18,
    letterSpacing: 0.5,
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    backgroundColor: "#333333",
    marginHorizontal: 5,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  selectedButton: {
    backgroundColor: "#FF6B00",
    borderColor: "#FF6B00",
  },
  typeButtonText: {
    fontSize: 14,
    color: "#BBBBBB",
    fontWeight: "500",
  },
  selectedButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  halfWidth: {
    width: "48%",
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 14,
    color: "#A0A0A0",
    marginBottom: 8,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333333",
    borderRadius: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "#FF6B00",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 25,
    marginBottom: 20,
    shadowColor: "#FF6B00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  loginLink: {
    alignItems: "center",
    marginBottom: 30,
  },
  loginText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
  },
  loginLinkText: {
    color: "#FF6B00",
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  countryCode: {
    color: "#FFFFFF",
    fontSize: 16,
    marginRight: 8,
    fontWeight: "500",
  },
  phoneInput: {
    marginLeft: 0,
  },
});