import { createContext, useContext, useState, useMemo, useCallback } from "react";
import { apiUrl } from "../utils/apiConfig";

const FeedbackContext = createContext(null);

export function FeedbackProvider({ children }) {
    const [feedbackState, setFeedbackState] = useState({});

    const setFeedback = useCallback((messageId, rating) => {
        setFeedbackState(prev => ({
            ...prev,
            [messageId]: rating
        }));
    }, []);

    const value = useMemo(() => ({
        feedbackState,
        setFeedback
    }), [feedbackState, setFeedback]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}
        </FeedbackContext.Provider>
    );
}

export function useFeedback() {
    const context = useContext(FeedbackContext);
    if (!context) {
        throw new Error("useFeedback must be used within a FeedbackProvider");
    }
    return context;
}