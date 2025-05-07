import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithCredential, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import CavalLogo from "../assets/Caval_courrier_logo-removebg-preview.png";
import { useTheme } from "../context/ThemeContext";
import AsyncStorage from '@react-native-async-storage/async-storage';

WebBrowser.maybeCompleteAuthSession();

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [authStateReady, setAuthStateReady] = useState(false);
  const navigation = useNavigation();
  const auth = getAuth();
  const { colors, toggleTheme, isDarkMode } = useTheme();

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: '1007561335979-3c5q3tvj8e5fig9hlas8hnrc6gpa999b.apps.googleusercontent.com',
    iosClientId: '1007561335979-ppmh7dnmssp44fnndtvm92ikaj5nm6vt.apps.googleusercontent.com',
    androidClientId: '1007561335979-uiduf2a3h59mjcdassp5hl3rgljr5tes.apps.googleusercontent.com',
    redirectUri: makeRedirectUri({
      scheme: 'com.googleusercontent.apps.1007561335979-uiduf2a3h59mjcdassp5hl3rgljr5tes'
    }),
    scopes: ['profile', 'email'],
  });

  // Clear auth state when the login screen is focused
  useFocusEffect(
    React.useCallback(() => {
      const checkAndClearAuth = async () => {
        setAuthStateReady(false);
        // Clear stored user data
        await AsyncStorage.removeItem('driverInfo');
        await AsyncStorage.removeItem('driverUID');
        
        // Ensure user is signed out when coming to login screen
        if (auth.currentUser) {
          await signOut(auth);
        }
        
        // Short delay to ensure auth state is cleared before re-enabling auth state monitoring
        setTimeout(() => {
          setAuthStateReady(true);
        }, 300);
      };
      
      checkAndClearAuth();
      
      return () => {
        // Cleanup if needed
      };
    }, [])
  );

  useEffect(() => {
    let unsubscribe = () => {};
    
    if (authStateReady) {
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            console.log("User authenticated:", user.uid);
            setLoading(true);
            
            // Fetch driver information from Firestore
            const driverDoc = await getDoc(doc(db, "Drivers", user.uid));
            console.log("Driver document exists:", driverDoc.exists());
            
            if (!driverDoc.exists()) {
              // If document doesn't exist in Drivers collection, check if it exists in Customers
              const customerDoc = await getDoc(doc(db, "Customers", user.uid));
              if (customerDoc.exists()) {
                console.log("User found in Customers collection");
                Alert.alert(
                  "Error",
                  "This account is registered as a customer. Please use the customer app.",
                  [{ text: "OK", onPress: () => signOut(auth) }]
                );
                setLoading(false);
                return;
              }
              
              Alert.alert(
                "Error",
                "Driver account not found. Please register as a driver first.",
                [{ text: "OK", onPress: () => signOut(auth) }]
              );
              setLoading(false);
              return;
            }

            // Store driver information in AsyncStorage
            const driverData = driverDoc.data();
            console.log("Driver data to store:", driverData);
            await AsyncStorage.setItem('driverInfo', JSON.stringify(driverData));
            await AsyncStorage.setItem('driverUID', user.uid);
            
            // Verify storage
            const storedData = await AsyncStorage.getItem('driverInfo');
            console.log("Stored driver data:", JSON.parse(storedData));
            
            navigation.navigate("HomeScreenWithMap");
          } catch (error) {
            console.error("Error fetching driver information:", error);
            Alert.alert("Error", "Failed to fetch driver information. Please try again.");
            await signOut(auth);
          } finally {
            setLoading(false);
          }
        }
      });
    }
    
    return () => unsubscribe();
  }, [auth, navigation, authStateReady]);

  useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      if (authentication?.accessToken) {
        handleGoogleSignInResponse(authentication.accessToken);
      }
    }
  }, [response]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.log(error.message);
      Alert.alert("Error", error.message);
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const result = await promptAsync();
      if (result?.type === 'success') {
        const { authentication } = result;
        if (authentication?.accessToken) {
          await handleGoogleSignInResponse(authentication.accessToken);
        }
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.log(error.message);
      Alert.alert("Error", error.message);
      setLoading(false);
    }
  };

  const handleGoogleSignInResponse = async (accessToken) => {
    try {
      const credential = GoogleAuthProvider.credential(null, accessToken);
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      // Fetch driver information from Firestore
      const driverDoc = await getDoc(doc(db, "Drivers", user.uid));
      
      if (!driverDoc.exists()) {
        // If document doesn't exist in Drivers collection, check if it exists in Customers
        const customerDoc = await getDoc(doc(db, "Customers", user.uid));
        if (customerDoc.exists()) {
          Alert.alert(
            "Error",
            "This account is registered as a customer. Please use the customer app.",
            [{ text: "OK", onPress: () => signOut(auth) }]
          );
          setLoading(false);
          return;
        }
        
        Alert.alert(
          "Error",
          "Driver account not found. Please register as a driver first.",
          [{ text: "OK", onPress: () => signOut(auth) }]
        );
        setLoading(false);
        return;
      }

      // Store driver information in AsyncStorage
      const driverData = driverDoc.data();
      await AsyncStorage.setItem('driverInfo', JSON.stringify(driverData));
      await AsyncStorage.setItem('driverUID', user.uid);
    } catch (error) {
      console.log(error.message);
      Alert.alert("Error", error.message);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={60}
    >
      <TouchableOpacity
        style={styles.themeToggle}
        onPress={toggleTheme}
      >
        <Ionicons
          name={isDarkMode ? "sunny" : "moon"}
          size={24}
          color={colors.text}
        />
      </TouchableOpacity>

      <Image style={styles.logo} source={CavalLogo} />

      <Text style={[styles.driverOnlyMessage, { color: colors.text }]}>
        Cette application est réservée uniquement aux chauffeurs Caval Courier
      </Text>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <TextInput
          style={[styles.input, { 
            backgroundColor: colors.input,
            color: colors.inputText,
            borderColor: colors.border,
          }]}
          placeholder="Email"
          placeholderTextColor={colors.placeholder}
          onChangeText={setEmail}
          value={email}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={[styles.input, { 
            backgroundColor: colors.input,
            color: colors.inputText,
            borderColor: colors.border,
          }]}
          placeholder="Mot de passe"
          placeholderTextColor={colors.placeholder}
          onChangeText={setPassword}
          value={password}
          secureTextEntry
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: colors.primary }]} 
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Connexion</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OU</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity 
          style={[styles.googleButton, { backgroundColor: colors.input }]}
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <Image 
            source={{ uri: 'https://www.google.com/favicon.ico' }} 
            style={styles.googleIcon} 
          />
          <Text style={[styles.googleButtonText, { color: colors.text }]}>
            Continuer avec Google
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[styles.linkText, { color: colors.text }]}
        onPress={() => navigation.navigate("RegisterScreen")}
      >
        Pas de compte ? Inscrivez-vous ici
      </Text>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  themeToggle: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    borderRadius: 20,
  },
  logo: {
    width: 300,
    height: undefined,
    aspectRatio: 1,
    alignSelf: "center",
    marginBottom: 40,
    resizeMode: "contain",
  },
  card: {
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 10,
    elevation: 5,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
  linkText: {
    textAlign: "center",
    marginTop: 20,
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 10,
    fontSize: 14,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginTop: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  driverOnlyMessage: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
});