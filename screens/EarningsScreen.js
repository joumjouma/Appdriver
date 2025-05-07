import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  StyleSheet, 
  Dimensions, 
  ScrollView, 
  SafeAreaView, 
  TouchableOpacity, 
  Platform, 
  StatusBar,
  Animated
} from "react-native";
import { BarChart } from "react-native-chart-kit";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTheme } from "../context/ThemeContext";
import { getAuth } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";

export default function EarningsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { colors, isDark } = useTheme();
  const [dailyEarnings, setDailyEarnings] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [activeTime, setActiveTime] = useState(route.params?.activeTime || 0);
  const [startTime, setStartTime] = useState(route.params?.startTime || null);
  const [isOnline, setIsOnline] = useState(route.params?.isOnline || false);
  const [selectedDay, setSelectedDay] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const auth = getAuth();
  const screenWidth = Dimensions.get("window").width - 40;
  
  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  // Update states when route params change
  useEffect(() => {
    if (route.params?.isOnline !== undefined) {
      setIsOnline(route.params.isOnline);
    }
    if (route.params?.activeTime !== undefined) {
      setActiveTime(route.params.activeTime);
    }
    if (route.params?.startTime !== undefined) {
      setStartTime(route.params.startTime);
    }
  }, [route.params?.isOnline, route.params?.activeTime, route.params?.startTime]);

  // Start animations after data loads
  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [loading]);

  // Format time in hours, minutes, and seconds
  const formatActiveTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  // Update active time every second
  useEffect(() => {
    let interval;
    if (isOnline && startTime) {
      interval = setInterval(() => {
        const currentTime = Math.floor((Date.now() - startTime) / 1000);
        setActiveTime(currentTime);
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [startTime, isOnline]);

  useEffect(() => {
    const fetchEarningsData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      try {
        // Fetch today's online time and status
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const docRef = doc(db, "driverStats", currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const stats = docSnap.data();
          const todayStats = stats.dailyStats?.find(
            (stat) => stat.date.toDate().toDateString() === today.toDateString()
          );

          if (todayStats) {
            // Set the start time based on the stored online time
            const storedSeconds = todayStats.onlineTime * 60;
            const currentTime = Date.now();
            setStartTime(currentTime - (storedSeconds * 1000));
            setActiveTime(storedSeconds);
            setIsOnline(true); // Set online status
          } else {
            // If no stats for today, set rides to 0
            setIsOnline(false);
          }
        } else {
          // If no stats document exists, set rides to 0
          setIsOnline(false);
        }

        // Fetch daily earnings for the past 7 days
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
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching earnings data:", error);
        setLoading(false);
      }
    };
    fetchEarningsData();
  }, []);

  // Generate appropriate day labels based on current date
  const generateDayLabels = () => {
    const today = new Date();
    const labels = [];
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(today.getDate() - i);
      // Format as abbreviated day name
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
    }
    
    return labels;
  };

  const chartData = {
    labels: generateDayLabels(),
    datasets: [
      {
        data: dailyEarnings,
        colors: dailyEarnings.map((_, index) => 
          (opacity = 1) => index === selectedDay && tooltipVisible
            ? isDark 
              ? `rgba(255, 255, 255, ${opacity})` 
              : `rgba(50, 50, 50, ${opacity})`
            : isDark 
              ? `rgba(200, 200, 255, ${opacity})` 
              : `rgba(94, 132, 226, ${opacity})`
        )
      },
    ],
  };

  const handleBarPress = (data) => {
    if (data && data.index !== undefined) {
      setSelectedDay(data.index);
      setTooltipVisible(true);
    }
  };

  // Calculate earnings percentage change
  const calculateChange = () => {
    if (dailyEarnings.length < 2) return { percentage: 0, increase: true };
    
    const lastDay = dailyEarnings[dailyEarnings.length - 1] || 0;
    const prevDay = dailyEarnings[dailyEarnings.length - 2] || 0;
    
    if (prevDay === 0) return { percentage: 0, increase: true };
    
    const change = ((lastDay - prevDay) / prevDay) * 100;
    return {
      percentage: Math.abs(change).toFixed(1),
      increase: change >= 0
    };
  };

  const earningsChange = calculateChange();

  // Progress indicator for current earnings against weekly goal
  const weeklyGoal = 1000; // Example goal
  const progressPercentage = Math.min((totalEarnings / weeklyGoal) * 100, 100);

  const getDate = (index) => {
    const today = new Date();
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading your earnings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Tableau de Bord des Gains</Text>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <Animated.View 
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          {/* Summary Card */}
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <View style={styles.summaryContent}>
              <View>
                <Text style={styles.summaryLabel}>Gains Hebdomadaires Totaux</Text>
                <Text style={styles.summaryAmount}>Fdj{totalEarnings.toFixed(2)}</Text>
                <View style={styles.changeContainer}>
                  <Ionicons 
                    name={earningsChange.increase ? "arrow-up" : "arrow-down"} 
                    size={14} 
                    color={earningsChange.increase ? "#4cd964" : "#ff3b30"} 
                  />
                  <Text style={[
                    styles.changeText, 
                    { color: earningsChange.increase ? "#4cd964" : "#ff3b30" }
                  ]}>
                    {earningsChange.percentage}% par rapport à hier
                  </Text>
                </View>
              </View>
            </View>
            <View style={styles.goalTracker}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalLabel}>Objectif Hebdomadaire</Text>
                <Text style={styles.goalAmount}>Fdj{totalEarnings.toFixed(0)}/{weeklyGoal}</Text>
              </View>
              <View style={styles.progressBarBackground}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${progressPercentage}%` }
                  ]} 
                />
              </View>
            </View>
          </View>

          {/* Today's Online Time Card */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Temps en Ligne Aujourd'hui</Text>
            </View>
            <View style={styles.onlineTimeContainer}>
              <Text style={[styles.onlineTime, { color: colors.primary }]}>
                {formatActiveTime(activeTime)}
              </Text>
              <View style={[
                styles.statusIndicator, 
                { backgroundColor: isOnline ? "#4cd964" : colors.border }
              ]}>
                <Text style={styles.statusText}>
                  {isOnline ? "EN LIGNE" : "HORS LIGNE"}
                </Text>
              </View>
            </View>
          </View>

          {/* Weekly Earnings Chart Card */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Performance Hebdomadaire</Text>
              {tooltipVisible && (
                <TouchableOpacity 
                  style={styles.resetButton}
                  onPress={() => setTooltipVisible(false)}
                >
                  <Text style={[styles.resetText, { color: colors.primary }]}>Réinitialiser</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.chartContainer}>
              <View style={styles.chartInfo}>
                <Text style={[styles.chartInfoText, { color: colors.textSecondary }]}>
                  Appuyez sur une barre pour voir les gains quotidiens
                </Text>
              </View>
              <BarChart
                data={chartData}
                width={screenWidth}
                height={220}
                yAxisLabel="Fdj"
                chartConfig={{
                  backgroundColor: colors.card,
                  backgroundGradientFrom: colors.card,
                  backgroundGradientTo: colors.card,
                  decimalPlaces: 0,
                  color: (opacity = 1) => isDark ? 
                    `rgba(255, 255, 255, ${opacity})` : 
                    `rgba(94, 132, 226, ${opacity})`,
                  labelColor: (opacity = 1) => 
                    `rgba(${isDark ? '255, 255, 255' : '0, 0, 0'}, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForBackgroundLines: {
                    strokeDasharray: '5, 5',
                    strokeWidth: 1,
                    stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  },
                  barPercentage: 0.7,
                }}
                style={styles.chart}
                showBarTops={false}
                withInnerLines={true}
                withOuterLines={false}
                withVerticalLabels={true}
                withHorizontalLabels={true}
                fromZero={true}
                onDataPointClick={handleBarPress}
                withCustomBarColorFromData={true}
                flatColor={true}
              />
              {tooltipVisible && selectedDay !== null && (
                <View
                  style={[
                    styles.tooltip,
                    {
                      left: `${(selectedDay / 6) * 80 + 10}%`, 
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.tooltipDay, { color: colors.text }]}>
                    {chartData.labels[selectedDay]}
                  </Text>
                  <Text style={[styles.tooltipDate, { color: colors.textSecondary }]}>
                    {getDate(selectedDay)}
                  </Text>
                  <Text style={[styles.tooltipAmount, { color: colors.primary }]}>
                    Fdj{dailyEarnings[selectedDay].toFixed(2)}
                  </Text>
                  <View 
                    style={[
                      styles.tooltipArrow, 
                      { borderTopColor: colors.card }
                    ]} 
                  />
                </View>
              )}
            </View>
          </View>
            
          {/* Weekly Statistics Card */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="stats-chart-outline" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Statistiques Hebdomadaires</Text>
            </View>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {(totalEarnings / 7).toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Moyenne Quotidienne
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {dailyEarnings.filter(amount => amount > 0).length}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Jours Actifs
                </Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>
                  {Math.max(...dailyEarnings).toFixed(2)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                  Meilleur Jour
                </Text>
              </View>
            </View>
          </View>

          {/* Achievement Badges */}
          <View style={[styles.card, { backgroundColor: colors.card }]}>
            <View style={styles.cardHeader}>
              <Ionicons name="trophy-outline" size={22} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Badges</Text>
            </View>
            <View style={styles.badgesContainer}>
              <View style={styles.badgeItem}>
                <View style={[styles.badgeIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="star" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.badgeText, { color: colors.text }]}>Top Performeur</Text>
              </View>
              <View style={styles.badgeItem}>
                <View style={[styles.badgeIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="time" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.badgeText, { color: colors.text }]}>Temps en Ligne</Text>
              </View>
              <View style={styles.badgeItem}>
                <View style={[styles.badgeIcon, { backgroundColor: colors.primary }]}>
                  <Ionicons name="cash" size={24} color="#FFFFFF" />
                </View>
                <Text style={[styles.badgeText, { color: colors.text }]}>Objectif Atteint</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  summaryCard: {
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
  },
  summaryContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 12,
    marginLeft: 4,
  },
  divider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  goalTracker: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 12,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  goalLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  goalAmount: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 3.84,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
    flex: 1,
  },
  resetButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  resetText: {
    fontSize: 14,
    fontWeight: "500",
  },
  onlineTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  onlineTime: {
    fontSize: 28,
    fontWeight: "700",
  },
  statusIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chartContainer: {
    position: 'relative',
    alignItems: 'center',
    marginTop: 8,
  },
  chartInfo: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartInfoText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  tooltip: {
    position: 'absolute',
    top: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: 130,
    alignItems: 'center',
    zIndex: 10,
    transform: [{ translateX: -65 }], // Center the tooltip
  },
  tooltipDay: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 2,
  },
  tooltipDate: {
    fontSize: 12,
    marginBottom: 4,
  },
  tooltipAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  tooltipArrow: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    height: '80%',
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  badgesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
  },
  badgeItem: {
    alignItems: 'center',
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});