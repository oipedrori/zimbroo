import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const SETTINGS_COLLECTION = 'userSettings';

/**
 * Salva ou atualiza os limites de um usuário.
 * limitsObj: { categoryId: amount, ... }
 */
export const saveUserLimits = async (userId, limitsObj, year) => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, userId);
        const fieldName = year ? `limits_${year}` : 'limits';
        await setDoc(docRef, { [fieldName]: limitsObj }, { merge: true });
        return limitsObj;
    } catch (error) {
        console.error("Error saving limits: ", error);
        throw error;
    }
};

/**
 * Busca os limites de um usuário uma única vez.
 */
export const getUserLimits = async (userId, year) => {
    try {
        const docRef = doc(db, SETTINGS_COLLECTION, userId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            const fieldName = year ? `limits_${year}` : 'limits';
            return data[fieldName] || {};
        }
        return {};
    } catch (error) {
        console.error("Error fetching limits: ", error);
        throw error;
    }
};
