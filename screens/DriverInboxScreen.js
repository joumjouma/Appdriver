import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Alert,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getAuth } from 'firebase/auth';

const formatMessageTime = (timestamp) => {
  if (!timestamp || !timestamp.toDate) return '';
  
  try {
    const date = timestamp.toDate();
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
};

const DriverInboxScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const flatListRef = useRef(null);
  const { conversationId, customerName, customerPhoto } = route.params;
  const [customerPhotoUrl, setCustomerPhotoUrl] = useState(customerPhoto);

  useEffect(() => {
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!conversationId || !currentUser) {
      setLoading(false);
      setError('Unable to load conversation');
      return;
    }

    // Get conversation details including customer photo
    const getConversationDetails = async () => {
      try {
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationDoc = await getDoc(conversationRef);
        if (conversationDoc.exists()) {
          const data = conversationDoc.data();
          // Store customer photo URL in state
          if (data.customerPhoto) {
            setCustomerPhotoUrl(data.customerPhoto);
          }
        }
      } catch (error) {
        console.error('Error fetching conversation details:', error);
      }
    };

    getConversationDetails();

    // Query messages for this conversation
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messageList = [];
      snapshot.forEach((doc) => {
        messageList.push({ id: doc.id, ...doc.data() });
      });
      setMessages(messageList);
      setLoading(false);
      setError(null);

      // Scroll to bottom when new messages arrive
      if (flatListRef.current && messageList.length > 0) {
        setTimeout(() => {
          flatListRef.current.scrollToEnd({ animated: true });
        }, 100);
      }
    }, (error) => {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages');
      setLoading(false);
    });

    // Mark conversation as read for driver
    const markAsRead = async () => {
      try {
        const conversationRef = doc(db, 'conversations', conversationId);
        await updateDoc(conversationRef, {
          'readBy.driver': true,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        console.error('Error marking conversation as read:', error);
      }
    };

    markAsRead();

    return () => unsubscribe();
  }, [conversationId]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('No authenticated user found');
      }

      // Add message to conversation
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const messageRef = await addDoc(messagesRef, {
        text: newMessage.trim(),
        senderId: currentUser.uid,
        senderType: 'driver',
        timestamp: serverTimestamp(),
        status: 'sending'
      });

      // Update message status to sent
      await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageRef.id), {
        status: 'sent'
      });

      // Update conversation's last message
      const conversationRef = doc(db, 'conversations', conversationId);
      await updateDoc(conversationRef, {
        lastMessage: newMessage.trim(),
        lastMessageTime: serverTimestamp(),
        lastMessageSender: currentUser.uid,
        lastSenderType: 'driver',
        updatedAt: serverTimestamp(),
        'readBy.customer': false
      });

      setNewMessage('');
      setError(null);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    const isDriver = item.senderId === currentUser.uid;
    const formattedTime = formatMessageTime(item.timestamp);

    return (
      <View style={[
        styles.messageContainer,
        isDriver ? styles.driverMessage : styles.customerMessage
      ]}>
        {!isDriver && (
          customerPhotoUrl ? (
            <Image
              source={{ uri: customerPhotoUrl }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.defaultAvatar]}>
              <Ionicons name="person" size={24} color="#fff" />
            </View>
          )
        )}
        <View style={[
          styles.messageBubble,
          isDriver ? styles.driverBubble : styles.customerBubble
        ]}>
          <Text style={styles.messageText}>{item.text}</Text>
          <View style={styles.messageFooter}>
            <Text style={styles.timestamp}>{formattedTime}</Text>
            {isDriver && (
              <Ionicons
                name={item.status === 'sending' ? 'time' : 'checkmark-done'}
                size={16}
                color={item.status === 'sent' ? '#4CAF50' : '#666'}
                style={styles.statusIcon}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#121212" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3E98FF" />
          <Text style={styles.loadingText}>Loading conversation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            {customerPhotoUrl ? (
              <Image
                source={{ uri: customerPhotoUrl }}
                style={styles.headerAvatar}
              />
            ) : (
              <View style={[styles.headerAvatar, styles.defaultHeaderAvatar]}>
                <Ionicons name="person" size={24} color="#fff" />
              </View>
            )}
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerName}>{customerName || 'Customer'}</Text>
              <Text style={styles.onlineStatus}>Online</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.moreButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={16} color="#fff" style={styles.errorIcon} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Messages List */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
            onLayout={() => flatListRef.current?.scrollToEnd()}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Message Input */}
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="attach" size={24} color="#888" />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121212',
  },
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1A1A1A',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  backButton: {
    padding: 4,
  },
  moreButton: {
    padding: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  headerTextContainer: {
    marginLeft: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FF6F00',
  },
  defaultHeaderAvatar: {
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  headerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  onlineStatus: {
    color: '#FF6F00',
    fontSize: 12,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
    marginBottom: Platform.OS === 'ios' ? 0 : 16,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 16,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-end',
  },
  driverMessage: {
    justifyContent: 'flex-end',
  },
  customerMessage: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    marginRight: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  defaultAvatar: {
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 18,
    elevation: 1,
  },
  driverBubble: {
    backgroundColor: '#FF6F00',
    borderBottomRightRadius: 4,
  },
  customerBubble: {
    backgroundColor: '#2A2A2A',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 22,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 6,
  },
  timestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
  },
  statusIcon: {
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#1A1A1A',
    borderTopWidth: 1,
    borderTopColor: '#333',
    position: 'relative',
    bottom: 0,
    left: 0,
    right: 0,
  },
  attachButton: {
    marginRight: 8,
    padding: 4,
  },
  input: {
    flex: 1,
    backgroundColor: '#2A2A2A',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#FF6F00',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(255, 111, 0, 0.5)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: '#E53935',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIcon: {
    marginRight: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DriverInboxScreen;