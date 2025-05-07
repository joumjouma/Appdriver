import { collection, addDoc, getDocs, query, where, doc, updateDoc, serverTimestamp, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const createConversation = async (driverId, customerId) => {
  try {
    // Create a consistent conversation ID based on the sorted IDs
    const sortedIds = [driverId, customerId].sort();
    const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;

    // Check if conversation already exists
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationSnap = await getDoc(conversationRef);

    if (!conversationSnap.exists()) {
      // Create new conversation
      await setDoc(conversationRef, {
        driverId,
        customerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        lastMessageTime: serverTimestamp(),
        lastMessageSender: null,
        readBy: {
          driver: true,
          customer: false
        }
      });
    }

    return conversationId;
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

export const getConversations = async (userId) => {
  try {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const conversations = [];
    
    querySnapshot.forEach((doc) => {
      conversations.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return conversations;
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
};

export const markConversationAsRead = async (conversationId, userId) => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    await updateDoc(conversationRef, {
      [`readBy.${userId}`]: true,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking conversation as read:', error);
    throw error;
  }
}; 