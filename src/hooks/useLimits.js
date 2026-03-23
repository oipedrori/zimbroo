import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { saveUserLimits } from '../services/limitService';

export const useLimits = (year) => {
    const { currentUser } = useAuth();
    const [limits, setLimitsState] = useState(() => {
        if (!currentUser) return {};
        const fieldKey = year ? `zimbroo_limits_${year}_${currentUser.uid}` : `zimbroo_limits_${currentUser.uid}`;
        const saved = localStorage.getItem(fieldKey);
        return saved ? JSON.parse(saved) : {};
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const docRef = doc(db, 'userSettings', currentUser.uid);
        const fieldName = year ? `limits_${year}` : 'limits';
        const fieldKey = year ? `zimbroo_limits_${year}_${currentUser.uid}` : `zimbroo_limits_${currentUser.uid}`;
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data()[fieldName] || {};
                setLimitsState(data);
                localStorage.setItem(fieldKey, JSON.stringify(data));
            } else {
                setLimitsState({});
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to limits: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser, year]);

    const setLimits = async (newLimits) => {
        if (!currentUser) return;
        
        // Optimistic Update
        const fieldKey = year ? `zimbroo_limits_${year}_${currentUser.uid}` : `zimbroo_limits_${currentUser.uid}`;
        const previousLimits = { ...limits };
        setLimitsState(newLimits);
        localStorage.setItem(fieldKey, JSON.stringify(newLimits));

        try {
            await saveUserLimits(currentUser.uid, newLimits, year);
        } catch (error) {
            // Rollback on failure
            setLimitsState(previousLimits);
            localStorage.setItem(fieldKey, JSON.stringify(previousLimits));
            throw error;
        }
    };

    return { limits, setLimits, loading };
};
