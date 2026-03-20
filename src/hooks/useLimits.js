import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from '../contexts/AuthContext';
import { saveUserLimits } from '../services/limitService';

export const useLimits = () => {
    const { currentUser } = useAuth();
    const [limits, setLimitsState] = useState(() => {
        if (!currentUser) return {};
        const saved = localStorage.getItem(`zimbroo_limits_${currentUser.uid}`);
        return saved ? JSON.parse(saved) : {};
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!currentUser) {
            setLoading(false);
            return;
        }

        const docRef = doc(db, 'userSettings', currentUser.uid);
        
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data().limits || {};
                setLimitsState(data);
                localStorage.setItem(`zimbroo_limits_${currentUser.uid}`, JSON.stringify(data));
            } else {
                setLimitsState({});
            }
            setLoading(false);
        }, (error) => {
            console.error("Error listening to limits: ", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const setLimits = async (newLimits) => {
        if (!currentUser) return;
        
        // Optimistic Update
        const previousLimits = { ...limits };
        setLimitsState(newLimits);
        localStorage.setItem(`zimbroo_limits_${currentUser.uid}`, JSON.stringify(newLimits));

        try {
            await saveUserLimits(currentUser.uid, newLimits);
        } catch (error) {
            // Rollback on failure
            setLimitsState(previousLimits);
            localStorage.setItem(`zimbroo_limits_${currentUser.uid}`, JSON.stringify(previousLimits));
            throw error;
        }
    };

    return { limits, setLimits, loading };
};
