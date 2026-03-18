import React, { useState, useEffect, useRef } from 'react';
import { Mic, Send, X, Keyboard } from 'lucide-react';
import { analyzeTextWithGemini } from '../services/geminiService';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';
import { haptic } from '../utils/haptic';
import ConfirmDialog from './ConfirmDialog';
import LoadingDots from './LoadingDots';

const AI_SUGGESTIONS = [
    "Gastei 50 reais no mercado",
    "Acabei de pagar meu jantar que foi 100 reais",
    "Paguei a conta de energia, foi 156 e 80",
    "Como está meu orçamento esse mês?",
    "O que eu preciso diminuir de gasto?",
    "Consigo comprar um celular novo?",
    "Adicione uma receita de 2000 reais",
    "Comprei uma pizza por 45 reais",
    "Quanto gastei com transporte este mês?",
    "Qual foi minha maior despesa?",
    "Sobrou dinheiro na conta?",
    "Adicione 20 reais de Uber",
    "Esqueci de anotar o almoço de 30 reais",
    "Recebi meu salário hoje, 5000 reais",
    "Quanto falta para atingir meu limite?",
    "Delete a última movimentação que fiz",
    "Mude o valor da internet para 90 reais",
    "Quanto gastei com lazer?",
    "Posso viajar no final do ano?",
    "Me mostre um resumo dos meus ganhos"
];

const AiPanel = ({ isActive, isTextMode = false, onClose, onOpenManualModal, onListeningChange }) => {
    const { currentUser } = useAuth();
    const { t, locale } = useI18n();
    const { transactions, addTx, deleteTx } = useTransactions(format(new Date(), 'yyyy-MM'));

    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [manualText, setManualText] = useState('');
    const [aiMessage, setAiMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeSuggestions, setActiveSuggestions] = useState([]);
    const [conversationContext, setConversationContext] = useState(null);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({});
    
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const transcriptRef = useRef('');
    const processTextRef = useRef(null);
    const silenceTimeoutRef = useRef(null);

    const firstName = currentUser?.displayName?.split(' ')[0] || '';

    // --- Speech Recognition Setup ---
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';

            recognition.onstart = () => setIsListening(true);
            recognition.onresult = (event) => {
                let current = '';
                for (let i = 0; i < event.results.length; ++i) {
                    current += event.results[i][0].transcript;
                }
                setTranscript(current);
                transcriptRef.current = current;

                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
                silenceTimeoutRef.current = setTimeout(() => {
                    if (transcriptRef.current.trim().length > 0 && !isProcessing) {
                        processInput(transcriptRef.current);
                    }
                }, 1500);
            };
            recognition.onerror = () => setIsListening(false);
            recognition.onend = () => setIsListening(false);
            recognitionRef.current = recognition;
        }
    }, [isProcessing]);

    // Update listening state for parent
    useEffect(() => {
        if (onListeningChange) onListeningChange(isListening);
    }, [isListening, onListeningChange]);

    // Handle Active State
    useEffect(() => {
        if (isActive) {
            setTranscript('');
            transcriptRef.current = '';
            setAiMessage('');
            setManualText('');
            setConversationContext(null);

            if (isTextMode) {
                setTimeout(() => inputRef.current?.focus(), 300);
            } else if (recognitionRef.current) {
                try { recognitionRef.current.start(); } catch (e) {}
            }
        } else {
            recognitionRef.current?.stop();
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        }
    }, [isActive, isTextMode]);

    // Suggestion Roulette
    useEffect(() => {
        let interval;
        if (isActive && !transcript && !manualText && !aiMessage && !isProcessing) {
            const pick = () => {
                const phrase = AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)];
                setActiveSuggestions([{ id: Date.now(), text: phrase }]);
            };
            pick();
            interval = setInterval(pick, 4000);
        } else {
            setActiveSuggestions([]);
        }
        return () => clearInterval(interval);
    }, [isActive, transcript, manualText, aiMessage, isProcessing]);

    const processInput = async (text) => {
        if (!text.trim() || isProcessing) return;
        
        recognitionRef.current?.stop();
        setIsListening(false);
        setIsProcessing(true);
        setAiMessage('');
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

        try {
            const result = await analyzeTextWithGemini(text, transactions, conversationContext, locale);
            
            if (result.error) {
                haptic.error();
                setAiMessage(result.error);
            } else if (result.action === 'need_info') {
                haptic.medium();
                setAiMessage(result.message);
                setConversationContext(result.pendingData);
                if (!isTextMode) setTimeout(() => recognitionRef.current?.start(), 1500);
            } else if (result.action === 'delete') {
                setConfirmConfig({
                    title: 'Excluir?',
                    message: result.message,
                    onConfirm: async () => {
                        await deleteTx(result.targetId);
                        haptic.success();
                        setAiMessage('Excluído com sucesso.');
                        setTimeout(onClose, 2000);
                        setIsConfirmOpen(false);
                    }
                });
                setIsConfirmOpen(true);
            } else if (result.action === 'add') {
                for (const tx of result.transactions) {
                    await addTx({
                        ...tx,
                        description: tx.description.charAt(0).toUpperCase() + tx.description.slice(1),
                        date: tx.date || format(new Date(), 'yyyy-MM-dd')
                    });
                }
                haptic.success();
                setAiMessage(result.transactions.length > 1 ? `Adicionados ${result.transactions.length} registros!` : 'Registro adicionado com sucesso!');
                setTimeout(onClose, 2500);
            } else {
                setAiMessage(result.message);
                if (!isTextMode) setTimeout(() => recognitionRef.current?.start(), 1500);
            }
        } catch (err) {
            setAiMessage('Erro ao processar. Tente novamente.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSend = () => processInput(manualText);

    if (!isActive) return null;

    const showSuggestions = !transcript && !manualText && !aiMessage && !isProcessing;
    const showLoading = isProcessing && !aiMessage;

    return (
        <div className="ai-modal-overlay">
            <div className="ai-modal-backdrop" onClick={onClose} />
            
            <div className="ai-popover-card">
                {/* Header */}
                <div className="ai-card-header">
                    <div className="ai-greeting-title">
                        {t('ai_greeting', { defaultValue: `Como posso ajudar, ${firstName}?` })}
                    </div>
                    <button className="ai-card-close glass-btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                {/* Content Area */}
                <div className="ai-card-body">
                    {/* Suggestions Roulette */}
                    {showSuggestions && (
                        <div className="ai-suggestions-roulette">
                            {activeSuggestions.map(s => (
                                <div key={s.id} className="ai-suggestion-item animate-roulette">
                                    "{s.text}"
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Live Transcript or Manual Text */}
                    {(transcript || manualText) && !aiMessage && !isProcessing && (
                        <div className="ai-user-transcript animate-fade-in">
                            {transcript || manualText}
                        </div>
                    )}

                    {/* Processing State */}
                    {showLoading && (
                        <div className="ai-processing-state animate-fade-in">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                            <span className="processing-text">Processando...</span>
                        </div>
                    )}

                    {/* AI Response */}
                    {aiMessage && !isProcessing && (
                        <div className="ai-response-text animate-fade-in">
                            {aiMessage}
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="ai-card-footer">
                    {isTextMode ? (
                        <div className="ai-text-input-wrapper">
                            <input 
                                ref={inputRef}
                                value={manualText}
                                onChange={(e) => setManualText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Digite aqui..."
                                className="ai-input-field"
                            />
                            <button className="ai-send-btn" onClick={handleSend} disabled={!manualText.trim() || isProcessing}>
                                <Send size={20} />
                            </button>
                        </div>
                    ) : (
                        <div className="ai-voice-controls">
                            <button className={`ai-action-fab ${isListening ? 'listening' : ''}`} onClick={() => !isListening && recognitionRef.current?.start()}>
                                {isListening ? <div className="pulse-ring" /> : null}
                                <Mic size={24} />
                            </button>
                            <span className="ai-voice-hint">
                                {isListening ? 'Ouvindo...' : 'Toque para falar'}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                {...confirmConfig}
            />

            <style>{`
                .ai-modal-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10000;
                    padding: 20px;
                }
                .ai-modal-backdrop {
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(27, 69, 32, 0.3);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    animation: fadeIn 0.3s ease-out;
                }
                .ai-popover-card {
                    position: relative;
                    width: 100%;
                    max-width: 420px;
                    background: rgba(var(--primary-rgb), 0.15);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 32px;
                    box-shadow: 0 20px 50px rgba(0,0,0,0.2), inset 0 0 0 1px rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    animation: popHover 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
                    transform-origin: bottom center;
                }
                @keyframes popHover {
                    0% { transform: scale(0.6) translateY(100px); opacity: 0; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                .ai-card-header {
                    padding: 24px 24px 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .ai-greeting-title {
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: white;
                    font-family: 'Solway', serif;
                }
                .ai-card-close {
                    width: 36px; height: 36px;
                    display: flex; align-items: center; justify-content: center;
                    border-radius: 50%; border: none; cursor: pointer;
                    color: white; opacity: 0.8;
                }
                .ai-card-body {
                    padding: 0 24px 24px;
                    min-height: 120px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    text-align: center;
                }
                .ai-suggestions-roulette {
                    height: 60px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .ai-suggestion-item {
                    font-size: 1.1rem;
                    color: rgba(255,255,255,0.7);
                    font-style: italic;
                    animation: fadeScale 0.4s ease-out;
                }
                .ai-user-transcript {
                    font-size: 1.25rem;
                    color: white;
                    font-weight: 500;
                    line-height: 1.4;
                    margin: 10px 0;
                }
                .ai-processing-state {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 12px;
                }
                .processing-text {
                    color: white;
                    font-size: 0.9rem;
                    font-weight: 600;
                    letter-spacing: 0.5px;
                }
                .ai-response-text {
                    font-size: 1.2rem;
                    color: white;
                    line-height: 1.5;
                    font-family: 'Solway', serif;
                }
                .ai-card-footer {
                    padding: 20px 24px 32px;
                    background: rgba(0,0,0,0.1);
                }
                .ai-text-input-wrapper {
                    display: flex;
                    gap: 12px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 20px;
                    padding: 8px 8px 8px 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .ai-input-field {
                    flex: 1;
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 1rem;
                    outline: none;
                }
                .ai-input-field::placeholder { color: rgba(255,255,255,0.4); }
                .ai-send-btn {
                    width: 40px; height: 40px;
                    border-radius: 50%; background: var(--primary-color);
                    border: none; color: white; display: flex;
                    align-items: center; justify-content: center; cursor: pointer;
                }
                .ai-voice-controls {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                }
                .ai-action-fab {
                    width: 64px; height: 64px;
                    border-radius: 50%; background: var(--primary-gradient);
                    border: none; color: white; display: flex;
                    align-items: center; justify-content: center; cursor: pointer;
                    position: relative;
                }
                .ai-voice-hint {
                    font-size: 0.8rem;
                    color: rgba(255,255,255,0.6);
                    font-weight: 600;
                }
                .listening .pulse-ring {
                    position: absolute;
                    width: 100%; height: 100%;
                    border-radius: 50%;
                    background: var(--primary-color);
                    opacity: 0.5;
                    animation: sonar 1.5s infinite;
                }
                @keyframes sonar {
                    0% { transform: scale(1); opacity: 0.5; }
                    100% { transform: scale(2); opacity: 0; }
                }
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeScale { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
                @keyframes fadeScaleDown { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fadeIn 0.3s ease-out forwards; }
                .animate-roulette { animation: fadeScaleDown 0.5s ease-out forwards; }
                
                .typing-indicator span {
                    width: 8px; height: 8px;
                    background-color: white;
                    border-radius: 50%;
                    display: inline-block;
                    margin: 0 2px;
                    animation: bounce 1.4s infinite ease-in-out both;
                }
                .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
                .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
                @keyframes bounce {
                    0%, 80%, 100% { transform: scale(0); }
                    40% { transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default AiPanel;
