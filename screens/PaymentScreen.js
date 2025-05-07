import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, TextInput, Alert, Image, ActivityIndicator, KeyboardAvoidingView, Platform, Animated, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../context/ThemeContext";
import { useNavigation } from "@react-navigation/native";
import { getAuth } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { useStripe } from '@stripe/stripe-react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";

const STRIPE_PUBLISHABLE_KEY = 'pk_live_51R9ek8CmEzIPQVTO8V3wcapg87N24eNFOCaJ4dz2krvfKSBaNe5g0vYAW4XBHESTYpQBi6fdz7GA4fPGJh4BlGIW00L1KYPz6m';

function PaymentScreen() {
  const { colors } = useTheme(), navigation = useNavigation(), auth = getAuth();
  const { createPaymentMethod, confirmPayment } = useStripe();
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [paymentMethods, setPaymentMethods] = useState([]);
  const [showAddCard, setShowAddCard] = useState(false), [selectedCardIndex, setSelectedCardIndex] = useState(null), [defaultCardId, setDefaultCardId] = useState(null);
  const [earnings, setEarnings] = useState(0), [transferAmount, setTransferAmount] = useState(''), [showTransferModal, setShowTransferModal] = useState(false);
  const [cardholderName, setCardholderName] = useState(""), [cardNumber, setCardNumber] = useState(""), [expiryDate, setExpiryDate] = useState(""), [cvv, setCvv] = useState("");
  const [bankName, setBankName] = useState(""), [accountType, setAccountType] = useState("personal");
  const swipeAnim = useRef(new Animated.Value(0)).current;
  const cardTypes = { visa: require("../assets/Visa.png"), mastercard: require("../assets/mastercard-logo.png"), amex: require("../assets/American-Express-Color.png") };
  
  useEffect(() => { fetchPaymentMethods(); fetchEarnings(); }, []);
  
  const fetchEarnings = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const earningsDocRef = doc(db, "Earnings", currentUser.uid),
            earningsDocSnap = await getDoc(earningsDocRef);
      if (earningsDocSnap.exists()) {
        const data = earningsDocSnap.data(),
              today = new Date().toISOString().split('T')[0];
        setEarnings(data.dailyBreakdown?.[today]?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching earnings:", error);
      Alert.alert("Error", "Failed to load earnings information.");
    }
  };

  const fetchPaymentMethods = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      const paymentDocRef = doc(db, "PaymentMethods", currentUser.uid),
            paymentDocSnap = await getDoc(paymentDocRef);
      if (paymentDocSnap.exists()) {
        const data = paymentDocSnap.data();
        setPaymentMethods(data.cards || []);
        setDefaultCardId(data.defaultCardId);
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      Alert.alert("Error", "Failed to load payment information.");
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async () => {
    if (!defaultCardId) { Alert.alert("Error", "Please select a default payment method first."); return; }
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) { Alert.alert("Error", "Please enter a valid amount."); return; }
    if (amount > earnings) { Alert.alert("Error", "Insufficient funds."); return; }
    try {
      setSaving(true);
      const currentUser = auth.currentUser,
            earningsDocRef = doc(db, "Earnings", currentUser.uid);
      await updateDoc(earningsDocRef, { totalEarnings: earnings - amount });
      setEarnings(earnings - amount);
      setTransferAmount('');
      setShowTransferModal(false);
      Alert.alert("Success", "Transfer completed successfully.");
    } catch (error) {
      console.error("Error processing transfer:", error);
      Alert.alert("Error", "Failed to process transfer. Please try again.");
    } finally { setSaving(false); }
  };

  const handleCardNumberChange = text => {
    let cleaned = text.replace(/\D/g, "").slice(0, 16), formatted = "";
    for (let i = 0; i < cleaned.length; i++) { if (i > 0 && i % 4 === 0) formatted += " "; formatted += cleaned[i]; }
    setCardNumber(formatted);
  };

  const handleExpiryDateChange = text => {
    const cleaned = text.replace(/\D/g, "");
    setExpiryDate(cleaned.length <= 2 ? cleaned : `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`);
  };

  const validateCardDetails = () => {
    if (!cardholderName.trim()) { Alert.alert("Error", "Please enter the cardholder name."); return false; }
    const cleanedNumber = cardNumber.replace(/\s/g, "");
    if (cleanedNumber.length < 16) { Alert.alert("Error", "Please enter a valid card number."); return false; }
    if (expiryDate.length < 5 || !expiryDate.includes('/')) { Alert.alert("Error", "Please enter a valid expiry date (MM/YY)."); return false; }
    const [month, year] = expiryDate.split("/"), currentDate = new Date(), currentYear = currentDate.getFullYear() % 100, currentMonth = currentDate.getMonth() + 1;
    if (parseInt(year) < currentYear || (parseInt(year) === currentYear && parseInt(month) < currentMonth)) { Alert.alert("Error", "Your card has expired. Please use a different card."); return false; }
    if (cvv.length < 3) { Alert.alert("Error", "Please enter a valid CVV."); return false; }
    return true;
  };

  const determineCardType = cardNum => {
    const cleaned = cardNum.replace(/\s/g, "");
    return cleaned.startsWith("4") ? "visa" : /^5[1-5]/.test(cleaned) ? "mastercard" : /^3[47]/.test(cleaned) ? "amex" : "visa";
  };

  const processPaymentWithStripe = async (cardDetails) => {
    try {
      setSaving(true);
      
      // Log the raw card details for debugging
      console.log('Raw card details:', {
        cardholderName: cardDetails.cardholderName,
        cardNumber: cardDetails.cardNumber,
        expiryDate: cardDetails.expiryDate,
        cvv: cardDetails.cvv ? '***' : 'missing',
        bankName: cardDetails.bankName,
        accountType: cardDetails.accountType
      });
      
      // Format card details properly
      const cardNumber = cardDetails.cardNumber.replace(/\s/g, '');
      const [expMonth, expYear] = cardDetails.expiryDate.split('/');
      
      // Ensure all required fields are present and properly formatted
      if (!cardNumber || cardNumber.length < 16) {
        throw new Error('Invalid card number');
      }
      
      if (!expMonth || !expYear || expMonth.length !== 2 || expYear.length !== 2) {
        throw new Error('Invalid expiry date');
      }
      
      if (!cardDetails.cvv || cardDetails.cvv.length < 3) {
        throw new Error('Invalid CVV');
      }
      
      if (!cardDetails.cardholderName) {
        throw new Error('Cardholder name is required');
      }
      
      // Log the formatted details
      console.log('Formatted card details:', {
        cardNumber: cardNumber,
        expMonth: expMonth,
        expYear: expYear,
        cvv: cardDetails.cvv ? '***' : 'missing'
      });
      
      // Try a different approach - create a payment method with minimal parameters
      const { paymentMethod, error } = await createPaymentMethod({
        paymentMethodType: 'Card',
        card: {
          number: cardNumber,
          expMonth: parseInt(expMonth),
          expYear: parseInt(expYear),
          cvc: cardDetails.cvv,
        }
      });

      if (error) {
        console.error('Stripe error details:', error);
        throw new Error(error.message);
      }

      console.log('Payment method created successfully:', paymentMethod.id);

      // Store the Stripe payment method ID in Firestore
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const newCard = {
        id: paymentMethod.id,
        cardholderName: cardDetails.cardholderName,
        lastFour: cardNumber.slice(-4),
        expiryDate: cardDetails.expiryDate,
        bankName: cardDetails.bankName || "Bank",
        cardType: determineCardType(cardNumber),
        dateAdded: new Date().toISOString(),
        accountType: cardDetails.accountType,
        stripePaymentMethodId: paymentMethod.id
      };

      const updatedCards = [...paymentMethods, newCard];
      const newDefaultId = paymentMethods.length === 0 ? newCard.id : defaultCardId;

      const paymentDocRef = doc(db, "PaymentMethods", currentUser.uid);
      await setDoc(paymentDocRef, {
        cards: updatedCards,
        defaultCardId: newDefaultId
      }, { merge: true });

      setPaymentMethods(updatedCards);
      setDefaultCardId(newDefaultId);
      resetCardForm();
      setShowAddCard(false);

      Alert.alert("Success", "Payment method added successfully.");
    } catch (error) {
      console.error("Error processing payment with Stripe:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to add payment method. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const saveCard = async () => { if (!validateCardDetails()) return; await processPaymentWithStripe({ cardholderName, cardNumber, expiryDate, cvv, bankName, accountType }); };
  const resetCardForm = () => { setCardholderName(""); setCardNumber(""); setExpiryDate(""); setCvv(""); setBankName(""); setAccountType("personal"); };
  const setAsDefault = async cardId => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    try {
      setLoading(true);
      const paymentDocRef = doc(db, "PaymentMethods", currentUser.uid);
      await updateDoc(paymentDocRef, { defaultCardId: cardId });
      setDefaultCardId(cardId);
      Alert.alert("Success", "Default payment method updated.");
    } catch (error) {
      console.error("Error updating default card:", error);
      Alert.alert("Error", "Failed to update default payment method.");
    } finally { setLoading(false); }
  };

  const deleteCard = async cardId => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    Alert.alert("Remove Card", "Are you sure you want to remove this payment method?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
          try {
            setLoading(true);
            const updatedCards = paymentMethods.filter(card => card.id !== cardId),
                  newDefaultId = cardId === defaultCardId ? (updatedCards.length > 0 ? updatedCards[0].id : null) : defaultCardId,
                  paymentDocRef = doc(db, "PaymentMethods", currentUser.uid);
            await updateDoc(paymentDocRef, { cards: updatedCards, defaultCardId: newDefaultId });
            setPaymentMethods(updatedCards);
            setDefaultCardId(newDefaultId);
            Alert.alert("Success", "Payment method removed successfully.");
          } catch (error) {
            console.error("Error removing payment method:", error);
            Alert.alert("Error", "Failed to remove payment method.");
          } finally { setLoading(false); }
        }
      }
    ]);
  };

  const renderCardIcon = cardType => <Image source={cardTypes[cardType] || cardTypes.visa} style={styles.cardLogo} resizeMode="contain" />;
  
  if (loading && !showAddCard)
    return <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}><ActivityIndicator size="large" color="#ff7e28" /></View>;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => { showAddCard ? (setShowAddCard(false), resetCardForm()) : navigation.goBack(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{showAddCard ? 'Add Bank' : 'Payment'}</Text>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
      {showAddCard ? (
        <ScrollView style={styles.formContainer} keyboardShouldPersistTaps="handled">
          <View style={[styles.cardPreview, { backgroundColor: colors.primary }]}>
            <View style={styles.cardPreviewHeader}>
              <Text style={styles.cardPreviewBank}>{bankName || "Your Bank"}</Text>
              <Ionicons name="wifi-outline" size={24} color="#FFF" style={{ transform: [{ rotate: '90deg' }] }} />
            </View>
            <Text style={styles.cardPreviewNumber}>{cardNumber || "•••• •••• •••• ••••"}</Text>
            <View style={styles.cardPreviewFooter}>
              <View>
                <Text style={styles.cardPreviewLabel}>CARD HOLDER</Text>
                <Text style={styles.cardPreviewValue}>{cardholderName || "Your Name"}</Text>
              </View>
              <View>
                <Text style={styles.cardPreviewLabel}>EXPIRES</Text>
                <Text style={styles.cardPreviewValue}>{expiryDate || "MM/YY"}</Text>
              </View>
              {cardNumber && renderCardIcon(determineCardType(cardNumber))}
            </View>
          </View>
          <View style={[styles.formSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.formSectionTitle, { color: colors.text }]}>Informations de la carte</Text>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nom du titulaire</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]} placeholder="John Doe" placeholderTextColor={colors.textSecondary} value={cardholderName} onChangeText={setCardholderName} autoCapitalize="words" />
            </View>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Numéro de carte</Text>
              <View style={[styles.inputWithIcon, { backgroundColor: colors.inputBackground }]}>
                <TextInput style={[styles.iconInput, { color: colors.text }]} placeholder="1234 5678 9012 3456" placeholderTextColor={colors.textSecondary} value={cardNumber} onChangeText={handleCardNumberChange} keyboardType="number-pad" maxLength={19} />
                {cardNumber && renderCardIcon(determineCardType(cardNumber))}
              </View>
            </View>
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date d'expiration</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]} placeholder="MM/AA" placeholderTextColor={colors.textSecondary} value={expiryDate} onChangeText={handleExpiryDateChange} keyboardType="number-pad" maxLength={5} />
              </View>
              <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>CVV</Text>
                <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]} placeholder="123" placeholderTextColor={colors.textSecondary} value={cvv} onChangeText={setCvv} keyboardType="number-pad" maxLength={4} secureTextEntry />
              </View>
            </View>
            <View style={styles.inputContainer}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Nom de la banque (Optionnel)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text }]} placeholder="ex: BNP, Crédit Agricole" placeholderTextColor={colors.textSecondary} value={bankName} onChangeText={setBankName} />
            </View>
          </View>
          <View style={[styles.formSection, { backgroundColor: colors.card }]}>
            <Text style={[styles.formSectionTitle, { color: colors.text }]}>Type de compte</Text>
            <View style={styles.accountTypeContainer}>
              <TouchableOpacity style={[styles.accountTypeButton, { backgroundColor: accountType === "personal" ? colors.primary : colors.inputBackground }]} onPress={() => setAccountType("personal")}>
                <Ionicons name="person" size={24} color={accountType === "personal" ? "#FFF" : colors.textSecondary} />
                <Text style={[styles.accountTypeText, { color: accountType === "personal" ? "#FFF" : colors.text }]}>Personnel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.accountTypeButton, { backgroundColor: accountType === "business" ? colors.primary : colors.inputBackground }]} onPress={() => setAccountType("business")}>
                <Ionicons name="briefcase" size={24} color={accountType === "business" ? "#FFF" : colors.textSecondary} />
                <Text style={[styles.accountTypeText, { color: accountType === "business" ? "#FFF" : colors.text }]}>Professionnel</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={[styles.secureInfoContainer, { backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed" size={18} color={colors.textSecondary} />
            <Text style={[styles.secureInfoText, { color: colors.textSecondary }]}>Vos informations sont cryptées et stockées de manière sécurisée. Nous ne stockons pas les numéros de carte complets.</Text>
          </View>
          <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.primary }]} onPress={saveCard} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveButtonText}>Enregistrer la carte</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowAddCard(false); resetCardForm(); }} disabled={saving}>
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Annuler</Text>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        <ScrollView style={styles.contentContainer}>
          <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.summaryTitle, { color: colors.text }]}>Gains d'aujourd'hui</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.text }]}>{earnings.toFixed(2)}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Gains du jour</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <TouchableOpacity style={[styles.transferButton, { backgroundColor: colors.primary }]} onPress={() => setShowTransferModal(true)} disabled={earnings <= 0}>
                  <Text style={styles.transferButtonText}>Retirer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={[styles.stripeSection, { backgroundColor: colors.card }]}>
            <View style={styles.stripeHeader}>
              <Image source={require('../assets/stripe-logo.png')} style={styles.stripeLogo} />
              <Text style={[styles.stripeTitle, { color: colors.text }]}>Propulsé par Stripe</Text>
            </View>
            <Text style={[styles.stripeDescription, { color: colors.textSecondary }]}>Traitement sécurisé des paiements propulsé par Stripe. Vos informations sont cryptées et sécurisées.</Text>
          </View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Vos cartes</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCard(true)}>
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {paymentMethods.length === 0 ? (
            <View style={[styles.emptyStateContainer, { backgroundColor: colors.card }]}>
              <Ionicons name="card-outline" size={60} color={colors.primary} />
              <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Aucune carte</Text>
              <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>Ajoutez une carte pour recevoir vos gains</Text>
              <TouchableOpacity style={[styles.emptyStateButton, { backgroundColor: colors.primary }]} onPress={() => setShowAddCard(true)}>
                <Text style={styles.emptyStateButtonText}>Ajouter une carte</Text>
              </TouchableOpacity>
            </View>
          ) : (
            paymentMethods.map((card, index) => (
              <View key={card.id} style={[styles.cardItem, { backgroundColor: colors.card }]}>
                <TouchableOpacity style={styles.cardItemContent} onPress={() => setSelectedCardIndex(selectedCardIndex === index ? null : index)}>
                  <View style={styles.cardItemLeft}>
                    {renderCardIcon(card.cardType)}
                    <View style={styles.cardItemDetails}>
                      <Text style={[styles.cardItemTitle, { color: colors.text }]}>{card.cardType === "amex" ? "American Express" : card.cardType === "mastercard" ? "Mastercard" : card.cardType === "visa" ? "Visa" : "Carte"} •••• {card.lastFour}</Text>
                      <Text style={[styles.cardItemSubtitle, { color: colors.textSecondary }]}>Expire le {card.expiryDate} • {card.accountType === "business" ? "Professionnel" : "Personnel"}</Text>
                    </View>
                  </View>
                  {defaultCardId === card.id && (<View style={[styles.defaultBadge, { backgroundColor: colors.primaryLight }]}><Text style={[styles.defaultBadgeText, { color: colors.primary }]}>Par défaut</Text></View>)}
                </TouchableOpacity>
                {selectedCardIndex === index && (
                  <View style={styles.cardActions}>
                    {defaultCardId !== card.id && (<TouchableOpacity style={[styles.cardActionButton, { backgroundColor: colors.primaryLight }]} onPress={() => setAsDefault(card.id)}>
                      <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
                      <Text style={[styles.cardActionText, { color: colors.primary }]}>Définir par défaut</Text>
                    </TouchableOpacity>)}
                    <TouchableOpacity style={[styles.cardActionButton, { backgroundColor: colors.errorLight }]} onPress={() => deleteCard(card.id)}>
                      <Ionicons name="trash" size={16} color={colors.error} />
                      <Text style={[styles.cardActionText, { color: colors.error }]}>Supprimer</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
          <TouchableOpacity style={[styles.addPaymentButton, { backgroundColor: colors.primaryLight }]} onPress={() => setShowAddCard(true)}>
            <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.addPaymentText, { color: colors.primary }]}>Ajouter une nouvelle carte</Text>
          </TouchableOpacity>
          <View style={[styles.helpCard, { backgroundColor: colors.card }]}>
            <View style={styles.helpHeader}>
              <Ionicons name="help-buoy" size={24} color={colors.primary} />
              <Text style={[styles.helpTitle, { color: colors.text }]}>Besoin d'aide ?</Text>
            </View>
            <Text style={[styles.helpText, { color: colors.textSecondary }]}>Contactez notre équipe de support pour toute question concernant vos paiements ou votre compte.</Text>
            <TouchableOpacity style={[styles.helpButton, { backgroundColor: colors.primaryLight }]} onPress={() => Linking.openURL('https://www.caval.tech/contact')}>
              <Text style={[styles.helpButtonText, { color: colors.primary }]}>Contacter le support</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.footerText, { color: colors.textSecondary }]}>Les détails sont cryptés et stockés de manière sécurisée. Pour des raisons de sécurité, nous ne stockons que les quatre derniers chiffres de votre carte.</Text>
        </ScrollView>
      )}
      </KeyboardAvoidingView>
      {showTransferModal && (
        <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Retirer des fonds</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.inputBackground, color: colors.text }]} placeholder="Entrez le montant" placeholderTextColor={colors.textSecondary} value={transferAmount} onChangeText={setTransferAmount} keyboardType="numeric" />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.error }]} onPress={() => setShowTransferModal(false)}>
                <Text style={styles.modalButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.primary }]} onPress={handleTransfer} disabled={saving}>
                {saving ? <ActivityIndicator color="#FFF" /> : <Text style={styles.modalButtonText}>Retirer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(0,0,0,0.05)" },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  backButton: { padding: 8 },
  contentContainer: { flex: 1, padding: 16 },
  summaryCard: { borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  summaryTitle: { fontSize: 18, fontWeight: "600", marginBottom: 12 },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  summaryLabel: { fontSize: 14 },
  summaryDivider: { width: 1, height: 40, backgroundColor: "rgba(0,0,0,0.1)", marginHorizontal: 12 },
  stripeSection: { borderRadius: 12, padding: 16, marginBottom: 16, alignItems: 'center' },
  stripeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stripeLogo: { width: 24, height: 24, marginRight: 8 },
  stripeTitle: { fontSize: 16, fontWeight: '600' },
  stripeDescription: { fontSize: 14, textAlign: 'center' },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  addButton: { padding: 6 },
  cardItem: { borderRadius: 12, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2, overflow: "hidden" },
  cardItemContent: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardItemLeft: { flexDirection: "row", alignItems: "center" },
  cardLogo: { width: 40, height: 30, marginRight: 12 },
  cardItemDetails: { flex: 1 },
  cardItemTitle: { fontSize: 16, fontWeight: "600", marginBottom: 4 },
  cardItemSubtitle: { fontSize: 13 },
  defaultBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  defaultBadgeText: { fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", justifyContent: "flex-end", padding: 12, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.05)" },
  cardActionButton: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginLeft: 8 },
  cardActionText: { marginLeft: 6, fontSize: 14, fontWeight: "500" },
  emptyStateContainer: { alignItems: "center", justifyContent: "center", padding: 24, borderRadius: 12, marginBottom: 16 },
  emptyStateTitle: { fontSize: 18, fontWeight: "700", marginTop: 16, marginBottom: 8 },
  emptyStateText: { fontSize: 14, textAlign: "center", marginBottom: 16 },
  emptyStateButton: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8 },
  emptyStateButtonText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  addPaymentButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 12, marginBottom: 16 },
  addPaymentText: { fontSize: 16, fontWeight: "600", marginLeft: 8 },
  helpCard: { borderRadius: 12, padding: 16, marginBottom: 16 },
  helpHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  helpTitle: { fontSize: 18, fontWeight: "600", marginLeft: 12 },
  helpText: { fontSize: 14, marginBottom: 16 },
  helpButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignSelf: "flex-start" },
  helpButtonText: { fontSize: 14, fontWeight: "600" },
  footerText: { fontSize: 12, textAlign: "center", marginVertical: 24, paddingHorizontal: 16 },
  formContainer: { flex: 1, padding: 16 },
  formSection: { borderRadius: 12, padding: 16, marginBottom: 16 },
  formSectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16 },
  inputContainer: { marginBottom: 16 },
  inputLabel: { fontSize: 14, marginBottom: 8 },
  input: { height: 50, borderRadius: 8, paddingHorizontal: 16, fontSize: 16 },
  inputWithIcon: { flexDirection: "row", alignItems: "center", height: 50, borderRadius: 8, paddingHorizontal: 16 },
  iconInput: { flex: 1, height: 50, fontSize: 16 },
  inputRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  accountTypeContainer: { flexDirection: "row", justifyContent: "space-between" },
  accountTypeButton: { flex: 1, padding: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", marginHorizontal: 4 },
  accountTypeText: { fontSize: 16, fontWeight: "600", marginTop: 8 },
  saveButton: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 16 },
  saveButtonText: { color: "#FFF", fontSize: 18, fontWeight: "600" },
  cancelButton: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8, marginBottom: 32 },
  cancelButtonText: { fontSize: 16, fontWeight: "500" },
  secureInfoContainer: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 12, marginBottom: 16 },
  secureInfoText: { fontSize: 12, marginLeft: 8, flex: 1 },
  cardPreview: { height: 200, borderRadius: 16, padding: 20, marginBottom: 20 },
  cardPreviewHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 30 },
  cardPreviewBank: { color: "#FFF", fontSize: 16, fontWeight: "600" },
  cardPreviewNumber: { color: "#FFF", fontSize: 22, fontWeight: "700", letterSpacing: 2, marginBottom: 30 },
  cardPreviewFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  cardPreviewLabel: { color: "rgba(255,255,255,0.8)", fontSize: 10, marginBottom: 4 },
  cardPreviewValue: { color: "#FFF", fontSize: 14, fontWeight: "600", textTransform: "uppercase" },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', padding: 20, borderRadius: 12, alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 20 },
  modalInput: { width: '100%', height: 50, borderRadius: 8, paddingHorizontal: 16, fontSize: 16, marginBottom: 20 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  modalButton: { flex: 1, height: 50, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginHorizontal: 8 },
  modalButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  transferButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  transferButtonText: { color: '#FFF', fontSize: 16, fontWeight: '600' }
});

export default PaymentScreen;
