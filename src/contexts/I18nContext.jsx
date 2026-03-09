import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, defaultCurrencyForLanguage, currencySymbols } from '../utils/translations';

const I18nContext = createContext();

export function useI18n() {
    return useContext(I18nContext);
}

export function I18nProvider({ children }) {
    const [locale, setLocale] = useState('pt');
    const [currency, setCurrency] = useState('BRL');

    useEffect(() => {
        // Detect browser language on init
        const browserLang = navigator.language || navigator.userLanguage;
        const baseLang = (browserLang || 'pt').split('-')[0].toLowerCase();

        // Check local storage
        const savedLocale = localStorage.getItem('zimbroo_locale');
        const savedCurrency = localStorage.getItem('zimbroo_currency');

        if (savedLocale && translations[savedLocale]) {
            setLocale(savedLocale);
        } else if (translations[baseLang]) {
            setLocale(baseLang);
            localStorage.setItem('zimbroo_locale', baseLang);
        } else {
            setLocale('en'); // fallback
        }

        if (savedCurrency) {
            setCurrency(savedCurrency);
        } else {
            const defaultCur = defaultCurrencyForLanguage[baseLang] || 'USD';
            setCurrency(defaultCur);
            localStorage.setItem('zimbroo_currency', defaultCur);
        }
    }, []);

    const t = (key, params = {}) => {
        let str = translations[locale]?.[key] || translations['en']?.[key] || params.defaultValue || key;

        // Check if any param is a React element
        const hasReactElements = Object.values(params).some(val => React.isValidElement(val));

        if (!hasReactElements) {
            Object.keys(params).forEach(k => {
                if (k !== 'defaultValue') {
                    str = str.replace(`{${k}}`, params[k]);
                }
            });
            return str;
        }

        // Handle React elements by splitting the string and inserting elements
        const parts = str.split(/(\{[^}]+\})/g);
        return parts.map((part, index) => {
            const match = part.match(/^\{([^}]+)\}$/);
            if (match) {
                const paramKey = match[1];
                return params[paramKey] !== undefined ? params[paramKey] : part;
            }
            return part;
        });
    };

    const changeLocale = (newLocale) => {
        if (translations[newLocale]) {
            setLocale(newLocale);
            localStorage.setItem('zimbroo_locale', newLocale);

            // Optionally auto-change currency if user hasn't strictly overridden it, 
            // but usually safer to just let them change currency if they want.
        }
    };

    const changeCurrency = (newCurrency) => {
        setCurrency(newCurrency);
        localStorage.setItem('zimbroo_currency', newCurrency);
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currency,
        }).format(value);
    };

    const getCurrencySymbol = () => {
        return currencySymbols[currency] || '$';
    };

    const value = {
        locale,
        currency,
        t,
        changeLocale,
        changeCurrency,
        formatCurrency,
        getCurrencySymbol
    };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
}
