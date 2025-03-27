import React from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import CavalLogo from "../assets/Caval_Logo.png";

function ActivityScreen() {
  const navigation = useNavigation();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="time-outline" size={24} color="#000" />
        <Text style={styles.headerTitle}>Activité</Text>
        <TouchableOpacity onPress={() => navigation.navigate("Settings")}>
          <Ionicons name="settings-outline" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Activity Cards */}
      <View style={styles.card}>
        <Text style={styles.cardHeader}>
          Aujourd'hui à 13:51 <Text style={styles.cardType}>Caval Privé</Text>
        </Text>
        <View style={styles.cardContent}>
          <Image style={styles.logo} source={CavalLogo} />
          <View style={styles.cardDetails}>
            <Text style={styles.address}>54, rue du Gue Jacquet</Text>
            <Text style={styles.address}>38, rue des Nations</Text>
            <Text style={styles.kilometers}>Distance: 8.5 km</Text>
            <Text style={styles.price}>550 Fdj</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeader}>
          Hier à 19:46 <Text style={styles.cardType}>Caval Taxi</Text>
        </Text>
        <View style={styles.cardContent}>
          <Image style={styles.logo} source={CavalLogo} />
          <View style={styles.cardDetails}>
            <Text style={styles.address}>14, boulevard Amiral</Text>
            <Text style={styles.address}>75, Rue Roussy</Text>
            <Text style={styles.kilometers}>Distance: 12.3 km</Text>
            <Text style={styles.price}>510 Fdj</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeader}>
          Jeudi à 17:30 <Text style={styles.cardType}>Caval Taxi</Text>
        </Text>
        <View style={styles.cardContent}>
          <Image style={styles.logo} source={CavalLogo} />
          <View style={styles.cardDetails}>
            <Text style={styles.address}>22, avenue Général</Text>
            <Text style={styles.address}>5, rue du Marché</Text>
            <Text style={styles.kilometers}>Distance: 5.4 km</Text>
            <Text style={styles.price}>400 Fdj</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardHeader}>
          Mardi à 08:15 <Text style={styles.cardType}>Caval Privé</Text>
        </Text>
        <View style={styles.cardContent}>
          <Image style={styles.logo} source={CavalLogo} />
          <View style={styles.cardDetails}>
            <Text style={styles.address}>78, rue des Écoles</Text>
            <Text style={styles.address}>45, rue de la Gare</Text>
            <Text style={styles.kilometers}>Distance: 10.1 km</Text>
            <Text style={styles.price}>600 Fdj</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

export default ActivityScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 10,
    paddingTop: 50,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "600",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    backgroundColor: "#FFE1C4",
    padding: 10,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    fontSize: 16,
    fontWeight: "600",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  cardType: {
    fontWeight: "bold",
    color: "#FF6F00",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  logo: {
    width: 50,
    height: 50,
    resizeMode: "contain",
    marginRight: 10,
  },
  cardDetails: {
    flex: 1,
  },
  address: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 5,
  },
  kilometers: {
    fontSize: 14,
    color: "#555",
    marginBottom: 5,
  },
  price: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
});
