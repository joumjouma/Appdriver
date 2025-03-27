import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons"; // For icons
import { getAuth, onAuthStateChanged } from "firebase/auth"; // Firebase Auth
import { ThemeProvider } from "./context/ThemeContext";
import { configureGoogleSignIn } from "./config/googleSignIn";

// Import Screens
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreenWithMap from "./screens/HomeScreenWithMap";
import RideInProgressScreen from "./screens/RideInProgressScreen";
import ProfileScreen from "./screens/ProfileScreen";
// Removed ActivityScreen import since it is no longer used
import SettingsScreen from "./screens/SettingsScreen";
import RideOptionsScreen from "./screens/RideOptionsScreen";
import EarningsScreen from "./screens/EarningsScreen";

import "react-native-get-random-values";

// Initialize Google Sign-in
configureGoogleSignIn();

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

export default function App() {
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);

  const authInstance = getAuth();

  // Check authentication state on app launch
  useEffect(() => {
    const checkAuthState = async () => {
      onAuthStateChanged(authInstance, async (user) => {
        if (user) {
          // User is signed in
          setAuth(user);
          await AsyncStorage.setItem("auth", JSON.stringify(user));
        } else {
          // No user is signed in
          await AsyncStorage.removeItem("auth");
          setAuth(null);
        }
        setLoading(false);
      });
    };
    checkAuthState();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Bottom Tab Navigator (Home and Profile only)
  function HomeTabs() {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Profile") {
              iconName = focused ? "person" : "person-outline";
            }
            return <Ionicons name={iconName} size={30} color={color} />;
          },
          tabBarActiveTintColor: "#ff9f43",
          tabBarInactiveTintColor: "gray",
          tabBarStyle: {
            backgroundColor: "#1e1e1e",
            borderTopColor: "transparent",
            position: "absolute",
            bottom: 0,
            height: 70,
            paddingBottom: 10,
            zIndex: 10,
          },
        })}
      >
        <Tab.Screen
          name="Home"
          options={{ headerShown: false }}
        >
          {() => <HomeScreenWithMap userName={auth?.displayName || "User"} />}
        </Tab.Screen>
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
      </Tab.Navigator>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator 
          initialRouteName={auth ? "HomeScreenWithMap" : "LoginScreen"}
        >
          {/* Authentication Screens */}
          <Stack.Screen
            name="LoginScreen"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RegisterScreen"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />

          {/* Bottom Tabs (Home and Profile) */}
          <Stack.Screen
            name="HomeScreenWithMap"
            component={HomeTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RideInProgressScreen"
            component={RideInProgressScreen}
            options={{ headerShown: false }}
          />

          {/* Ride Options Screen */}
          <Stack.Screen
            name="RideOptionsScreen"
            component={RideOptionsScreen}
            options={{
              headerTitle: "Ride Options",
              headerStyle: { backgroundColor: "#ff9f43" },
              headerTintColor: "#fff",
              headerTitleAlign: "center",
            }}
          />
          <Stack.Screen
            name="EarningsScreen"
            component={EarningsScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="SettingsScreen"
            component={SettingsScreen}
            options={{
              headerTitle: "Settings",
              headerStyle: { backgroundColor: "#ff9f43" },
              headerTintColor: "#fff",
              headerTitleAlign: "center",
            }}
          />
          {/* If needed, Profile can also be accessed in the Stack */}
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
