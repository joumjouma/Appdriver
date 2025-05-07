import React, { useState } from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "react-native-vector-icons/Ionicons"; // For icons
import { auth } from "./config/firebase";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";

// Import Screens
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreenWithMap from "./screens/HomeScreenWithMap";
import RideInProgressScreen from "./screens/RideInProgressScreen";
import ProfileScreen from "./screens/ProfileScreen";
import SettingsScreen from "./screens/SettingsScreen";
import RideOptionsScreen from "./screens/RideOptionsScreen";
import EarningsScreen from "./screens/EarningsScreen";
import ModifyInfo from "./screens/ModifyInfo";
import PaymentScreen from "./screens/PaymentScreen";
import DriverInboxScreen from "./screens/DriverInboxScreen";
import "react-native-get-random-values";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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
        {() => <HomeScreenWithMap userName="User" />}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
    </Tab.Navigator>
  );
}

// Create a wrapper component to use the auth context
const AppContent = () => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#ff9f43" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? "HomeScreenWithMap" : "LoginScreen"}
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
        <Stack.Screen
          name="DriverInboxScreen"
          component={DriverInboxScreen}
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
          name="ModifyInfo"
          component={ModifyInfo}
          options={{ headerShown: false }}
        />
         <Stack.Screen
          name="PaymentScreen"
          component={PaymentScreen}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="SettingsScreen"
          component={SettingsScreen}
          options={{headerShown: false
          }}
        />
        {/* If needed, Profile can also be accessed in the Stack */}
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e1e1e",
  },
});
