import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Dimensions, ScrollView, SafeAreaView, TouchableOpacity } from "react-native";
import { BarChart } from "react-native-chart-kit";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase"; // Adjust to your Firebase configuration
import { useNavigation } from "@react-navigation/native";

export default function Revenus() {
  const navigation = useNavigation();
  const [dailyEarnings, setDailyEarnings] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [weeklyStats, setWeeklyStats] = useState({
    onlineTime: "0 h 0 min",
    totalTrips: 0,
    points: 0,
  });
  const [breakdownEarnings, setBreakdownEarnings] = useState({
    netRides: 0,
    promotions: 0,
    tips: 0,
  });
  const [ridesToday, setRidesToday] = useState(0); // New state for rides completed today

  const auth = getAuth();
  const screenWidth = Dimensions.get("window").width - 40;

  useEffect(() => {
    const fetchEarningsData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        // Fetch daily earnings for the past 7 days
        const today = new Date();
        const dailyData = [];
        const earnings = [];

        for (let i = 6; i >= 0; i--) {
          const date = new Date(today);
          date.setDate(today.getDate() - i);
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const day = date.getDate().toString().padStart(2, "0");
          const docId = `${currentUser.uid}_${year}${month}${day}`;

          const docRef = doc(db, "moneyByRider", docId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            dailyData.push(data.total || 0);
            earnings.push(parseFloat((data.total || 0).toFixed(2)));
          } else {
            dailyData.push(0);
            earnings.push(0);
          }
        }

        setDailyEarnings(earnings);
        setTotalEarnings(earnings.reduce((a, b) => a + b, 0));

        // Fetch weekly stats
        const statsRef = doc(db, "driverStats", currentUser.uid);
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
          const stats = statsSnap.data();
          setWeeklyStats({
            onlineTime: stats.onlineTime || "0 h 0 min",
            totalTrips: stats.totalTrips || 0,
            points: stats.points || 0,
          });
        }

        // Fetch earnings breakdown
        const today7DaysAgo = new Date();
        today7DaysAgo.setDate(today7DaysAgo.getDate() - 7);

        const q = query(
          collection(db, "moneyByRider"),
          where("driverId", "==", currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        let netRides = 0,
          promotions = 0,
          tips = 0;

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          netRides += data.netRides || 0;
          promotions += data.promotions || 0;
          tips += data.tips || 0;
        });

        setBreakdownEarnings({
          netRides: parseFloat(netRides.toFixed(2)),
          promotions: parseFloat(promotions.toFixed(2)),
          tips: parseFloat(tips.toFixed(2)),
        });

        // Fetch rides completed today
        const todayDocId = `${currentUser.uid}_${today.getFullYear()}${(today.getMonth() + 1)
          .toString()
          .padStart(2, "0")}${today.getDate().toString().padStart(2, "0")}`;
        const todayDocRef = doc(db, "moneyByRider", todayDocId);
        const todayDocSnap = await getDoc(todayDocRef);
        if (todayDocSnap.exists()) {
          const todayData = todayDocSnap.data();
          setRidesToday(todayData.trips ? todayData.trips.length : 0);
        }
      } catch (error) {
        console.error("Error fetching earnings data:", error);
      }
    };

    fetchEarningsData();
  }, []);

  // Chart data for the week
  const chartData = {
    labels: ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"],
    datasets: [
      {
        data: dailyEarnings,
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollView}>
        {/* Back Button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back-outline" size={24} color="#ff9f43" />
        </TouchableOpacity>

        {/* Header Section */}
        <LinearGradient
          colors={["#ff9f43", "#ff6f61"]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.headerTitle}>Earnings Overview</Text>
          <Text style={styles.headerSubtitle}>Detailed insights into your performance</Text>
        </LinearGradient>

        {/* Total Earnings */}
        <View style={styles.totalEarningsContainer}>
          <Text style={styles.totalEarningsLabel}>Total Earnings</Text>
          <Text style={styles.totalEarningsValue}>€{totalEarnings.toFixed(2)}</Text>
        </View>

        {/* Rides Completed Today */}
        <View style={styles.metricCard}>
          <Ionicons name="car-outline" size={24} color="#ff9f43" style={styles.metricIcon} />
          <View style={styles.metricDetails}>
            <Text style={styles.metricTitle}>Rides Completed Today</Text>
            <Text style={styles.metricValue}>{ridesToday}</Text>
          </View>
        </View>

        {/* Bar Chart */}
        <BarChart
          data={chartData}
          width={screenWidth}
          height={220}
          yAxisLabel="€"
          chartConfig={{
            backgroundColor: "#1F1F1F",
            backgroundGradientFrom: "#1F1F1F",
            backgroundGradientTo: "#1F1F1F",
            color: (opacity = 1) => `rgba(255, 159, 67, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            barPercentage: 0.6,
          }}
          style={styles.chartStyle}
          fromZero
          showBarTops
        />

        {/* Statistics Section */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsHeader}>Statistics</Text>
          <View style={styles.statRow}>
            <Ionicons name="time-outline" size={24} color="#ff9f43" style={styles.statIcon} />
            <Text style={styles.statsText}>Online Time: {weeklyStats.onlineTime}</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="car-outline" size={24} color="#ff9f43" style={styles.statIcon} />
            <Text style={styles.statsText}>Total Trips: {weeklyStats.totalTrips}</Text>
          </View>
          <View style={styles.statRow}>
            <Ionicons name="ribbon-outline" size={24} color="#ff9f43" style={styles.statIcon} />
            <Text style={styles.statsText}>Points Earned: {weeklyStats.points}</Text>
          </View>
        </View>

        {/* Earnings Breakdown */}
        <View style={styles.breakdownContainer}>
          <Text style={styles.breakdownHeader}>Earnings Breakdown</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Net Rides:</Text>
            <Text style={styles.breakdownValue}>€{breakdownEarnings.netRides.toFixed(2)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Promotions:</Text>
            <Text style={styles.breakdownValue}>€{breakdownEarnings.promotions.toFixed(2)}</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Tips:</Text>
            <Text style={styles.breakdownValue}>€{breakdownEarnings.tips.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1F1F1F",
  },
  scrollView: {
    flexGrow: 1,
    alignItems: "center",
    paddingTop: 20,
  },
  backButton: {
    position: "absolute",
    top: 20,
    left: 20,
    zIndex: 1,
  },
  header: {
    width: "100%",
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 5,
  },
  totalEarningsContainer: {
    width: "90%",
    backgroundColor: "#2E2E2E",
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    alignItems: "center",
  },
  totalEarningsLabel: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    marginBottom: 10,
  },
  totalEarningsValue: {
    fontSize: 28,
    color: "#ff9f43",
    fontWeight: "bold",
  },
  metricCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E2E2E",
    width: "90%",
    padding: 15,
    borderRadius: 15,
    marginBottom: 20,
  },
  metricIcon: {
    marginRight: 15,
  },
  metricDetails: {
    flex: 1,
  },
  metricTitle: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 20,
    color: "#ff9f43",
    fontWeight: "bold",
    marginTop: 5,
  },
  chartStyle: {
    marginVertical: 20,
    borderRadius: 8,
  },
  statsContainer: {
    width: "90%",
    backgroundColor: "#2E2E2E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  statsHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  statIcon: {
    marginRight: 10,
  },
  statsText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  breakdownContainer: {
    width: "90%",
    backgroundColor: "#2E2E2E",
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  breakdownHeader: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  breakdownLabel: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  breakdownValue: {
    fontSize: 16,
    color: "#ff9f43",
    fontWeight: "600",
  },
});