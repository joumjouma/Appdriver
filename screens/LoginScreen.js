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
import { useNavigation } from "@react-navigation/native";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { Ionicons } from "@expo/vector-icons";
import CavalLogo from "../assets/vgae.png";
import { useTheme } from "../context/ThemeContext";

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();
  const auth = getAuth();
  const { colors, toggleTheme, isDarkMode } = useTheme();

  // Listen for authentication state changes.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is logged in; navigate to HomeScreenWithMap.
        navigation.navigate("HomeScreenWithMap");
      }
    });
    return unsubscribe;
  }, [auth, navigation]);

  const handleLogin = async () => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.log(error.message);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await GoogleSignin.hasPlayServices();
      const { idToken } = await GoogleSignin.signIn();
      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithPopup(auth, googleCredential);
    } catch (error) {
      console.log(error.message);
      Alert.alert("Error", error.message);
    } finally {
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
          placeholder="Password"
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
            <Text style={styles.buttonText}>Log In</Text>
          )}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
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
            Continue with Google
          </Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[styles.linkText, { color: colors.text }]}
        onPress={() => navigation.navigate("RegisterScreen")}
      >
        Don't have an account? Sign up here
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
});