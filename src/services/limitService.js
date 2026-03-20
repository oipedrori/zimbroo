import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_COLLECTION = 'userSettings';

/**
 * Salva ou atualiza os limites de um usuário.
 * limitsObj: { categoryId: amount, ... }
 */
export const saveUserLimits = async (userId, limitsObj) => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, userId);
        await setDoc(docRef, { limits: limitsObj }, { merge: true });
        return limitsObj;
    } catch (error) {
        console.error("Error saving limits: ", error);
        throw error;
    }
};

/**
 * Busca os limites de um usuário uma única vez.
 */
export const getUserLimits = async (userId) => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data().limits || {};
        }
        return {};
    } catch (error) {
        console.error("Error fetching limits: ", error);
        throw error;
    }
};
