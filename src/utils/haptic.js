/**
 * Utilitário para feedback háptico (vibração)
 */
export const haptic = {
    /**
     * Vibração curta e leve (sucesso ou toque)
     */
    light: () => {
        if (navigator.vibrate) {
            navigator.vibrate(15);
        }
    },

    /**
     * Vibração média (confirmação de ação)
     */
    medium: () => {
        if (navigator.vibrate) {
            navigator.vibrate(30);
        }
    },

    /**
     * Vibração de "sucesso" (dois toques rápidos)
     */
    success: () => {
        if (navigator.vibrate) {
            navigator.vibrate([20, 50, 20]);
        }
    },

    /**
     * Vibração de erro (três toques rápidos)
     */
    error: () => {
        if (navigator.vibrate) {
            navigator.vibrate([50, 100, 50, 100, 50]);
        }
    },

    /**
     * Vibração longa
     */
    heavy: () => {
        if (navigator.vibrate) {
            navigator.vibrate(100);
        }
    }
};
