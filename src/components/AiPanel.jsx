import React, { useState, useEffect, useRef } from 'react';
import { Mic, Plus, Edit2, Send, X, Check } from 'lucide-react';
import { analyzeTextWithGemini } from '../services/geminiService';
import { useTransactions } from '../hooks/useTransactions';
import { useLimits } from '../hooks/useLimits';
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
    "Qual foi minha maior despesa em março?",
    "Sobrou dinheiro na conta?",
    "Adicione 20 reais de Uber",
    "Esqueci de anotar o almoço de 30 reais",
    "Recebi meu salário hoje, 5000 reais",
    "Quanto falta para atingir meu limite?",
    "Delete a última movimentação que fiz",
    "Mude o valor da conta de internet para 90 reais",
    "Fiz uma transferência de 200 reais",
    "Gastei 15 reais na farmácia",
    "Como foi meu gasto com alimentação semana passada?",
    "Posso viajar no final do ano?",
    "Me mostre um resumo dos meus ganhos",
    "Quanto eu economizei este mês?",
    "Adicione uma compra de 120 reais na Amazon",
    "Paguei o condomínio, 450 reais",
    "Recebi um PIX de 50 reais do meu irmão",
    "Quanto gastei com café este mês?",
    "Adicione 10 reais de pão na padaria",
    "Minhas despesas fixas estão em dia?",
    "Qual a média de gastos diários?",
    "Gastei 300 reais em roupas novas",
    "Adicione 60 reais de gasolina",
    "Como está minha reserva de emergência?",
    "Quanto gastei no total hoje?",
    "Paguei a fatura do cartão, 1200 reais",
    "Recebi 150 reais de cashback",
    "Adicione 5 reais de estacionamento",
    "Quanto gastei com saúde este ano?",
    "Minha renda aumentou comparado ao mês passado?",
    "Adicione 80 reais de presente para minha mãe",
    "Paguei o streaming da Netflix, 40 reais",
    "Como economizar 200 reais por mês?",
    "Quanto gastei na feira hoje?",
    "Adicione 35 reais de ração para o cachorro",
    "Recebi um bônus de 500 reais",
    "Qual minha categoria mais cara?",
    "Adicione 12 reais de metrô",
    "Quanto gastei com educação este mês?",
    "Posso sair para jantar hoje?",
    "Faça um balanço da minha conta"
];



const AiPanel = ({ isActive, isTextMode = false, onClose, onOpenManualModal, onListeningChange }) => {
    const [isListening, setIsListening] = useState(false);
    const { currentUser } = useAuth();
    const firstName = currentUser?.displayName?.split(' ')[0] || '';

    useEffect(() => {
        if (onListeningChange) {
            onListeningChange(isListening);
        }
    }, [isListening, onListeningChange]);

    const [transcript, setTranscript] = useState('');
    const [aiMessage, setAiMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isManualTextMode, setIsManualTextMode] = useState(false);
    const [manualText, setManualText] = useState('');
    const [conversationContext, setConversationContext] = useState(null);
    const [activeSuggestions, setActiveSuggestions] = useState([]);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmConfig, setConfirmConfig] = useState({});
    const [viewportHeight, setViewportHeight] = useState(window.innerHeight);
    const [viewportOffset, setViewportOffset] = useState(0);
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimeoutRef = useRef(null);
    const transcriptRef = useRef(''); // To keep latest state for timeout

    const { transactions, addTx, deleteTx } = useTransactions(format(new Date(), 'yyyy-MM'));
    const { limits, setLimits } = useLimits(new Date().getFullYear());
    const { t, locale } = useI18n();

    const [micPermission, setMicPermission] = useState('prompt'); // 'prompt', 'granted', 'denied'

    // Check permission state on mount
    useEffect(() => {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'microphone' }).then(result => {
                setMicPermission(result.state);
                result.onchange = () => setMicPermission(result.state);
            }).catch(err => console.warn("Permissions API not supported for mic:", err));
        }
    }, []);

    // Setup Speech Recognition
    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';

            recognition.onstart = () => {
                setIsListening(true);
                setMicPermission('granted');
            };

            recognition.onresult = (event) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
                transcriptRef.current = currentTranscript;

                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

                silenceTimeoutRef.current = setTimeout(() => {
                    if (transcriptRef.current.trim().length > 0 && !isProcessing) {
                        processTextRef.current(transcriptRef.current);
                    }
                }, 1500);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                if (event.error === 'not-allowed') {
                    setMicPermission('denied');
                }
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            };

            recognition.onend = () => {
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }, [isProcessing]);

    // Monitora mudança na prop isActive do bottom-nav para ligar o microfone automaticamente
    useEffect(() => {
        if (isActive) {
            setTranscript('');
            transcriptRef.current = '';
            setAiMessage('');
            setIsManualTextMode(isTextMode);
            setManualText('');
            setConversationContext(null);

            // Se for modo texto, foca o input
            if (isTextMode) {
                const focusInput = () => {
                    if (inputRef.current) {
                        inputRef.current.focus();
                        // Trick for mobile to really show keyboard
                        inputRef.current.click();
                    }
                };
                focusInput();
                setTimeout(focusInput, 50);
                setTimeout(focusInput, 300);
            }

            // Try starting mic only if NOT in text mode
            if (recognitionRef.current && !isTextMode) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.error("Auto-start failure", e);
                }
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            document.body.classList.add('no-scroll');
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            setIsListening(false);
            document.body.classList.remove('no-scroll');
        }
        
        return () => {
            document.body.classList.remove('no-scroll');
        };
    }, [isActive, isTextMode]); // Add isTextMode dependency

    // Visual Viewport logic to handle keyboard
    useEffect(() => {
        if (!window.visualViewport) return;

        const handleResize = () => {
            const vv = window.visualViewport;
            // offset simple calculation
            const offset = window.innerHeight - vv.height;
            setViewportOffset(offset > 50 ? offset : 0);
            setViewportHeight(vv.height);
        };

        window.visualViewport.addEventListener('resize', handleResize);
        window.visualViewport.addEventListener('scroll', handleResize);
        
        return () => {
            window.visualViewport?.removeEventListener('resize', handleResize);
            window.visualViewport?.removeEventListener('scroll', handleResize);
        };
    }, []);

    // Lógica das frases flutuantes (Refinada: uma por vez com cross-fade)
    useEffect(() => {
        let interval;
        if (isActive && isListening && !transcript && !aiMessage) {
            const pickNext = () => {
                const phrase = AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)];
                setActiveSuggestions(prev => {
                    const next = [...prev, { id: Math.random(), text: phrase }];
                    if (next.length > 2) return next.slice(1);
                    return next;
                });
            };

            pickNext();
            interval = setInterval(pickNext, 5000);
        } else {
            setActiveSuggestions([]);
        }
        return () => clearInterval(interval);
    }, [isActive, isListening, transcript, aiMessage]);

    const toggleListen = () => {
        if (isListening) {
            onClose();
        } else {
            setTranscript('');
            recognitionRef.current?.start();
        }
    };

    const handleManualAdd = () => {
        onClose();
        onOpenManualModal();
    };

    const processTextRef = useRef(null);

    // We update the ref implementation so the timer always calls the latest logic
    useEffect(() => {
        processTextRef.current = async (textToProcess) => {
            if (!textToProcess.trim() || isProcessing) return;

            recognitionRef.current?.stop();
            setIsListening(false);
            setIsProcessing(true);
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

            setAiMessage(''); // Clear message to show dots


            try {
                const result = await analyzeTextWithGemini(textToProcess, transactions, conversationContext, locale);
                console.log("GEMINI RAW RESULT:", result); // DEBUGS

                if (result.error) {
                    console.error("Gemini returned an error flag:", result.error);
                    haptic.error();
                    setAiMessage(result.error);
                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);
                } else if (result.action === 'need_info') {
                    haptic.medium();
                    setAiMessage(result.message);
                    setConversationContext(result.pendingData);
                    // Do not clear the transcript so the user remembers what they just said.
                    setManualText('');
                    if (!isManualTextMode) {
                        // Restart mic to listen to the answer after reading
                        setTimeout(() => {
                            recognitionRef.current?.start();
                        }, 1000);
                    }
                } else if (result.action === 'delete') {
                    setConfirmConfig({
                        title: t('confirm_delete', { defaultValue: 'Excluir Movimentação' }),
                        message: result.message || t('confirm_delete_msg', { defaultValue: 'Tem certeza que deseja excluir este registro?' }),
                        onConfirm: async () => {
                            try {
                                await deleteTx(result.targetId);
                                haptic.success();
                                setAiMessage(t('transaction_removed', { defaultValue: "A movimentação foi removida." }));
                                setTranscript('');
                                transcriptRef.current = '';
                                setTimeout(() => onClose(), 2000);
                            } catch (e) {
                                console.error(e);
                                setAiMessage(t('error_deleting', { defaultValue: "Erro ao excluir." }));
                            } finally {
                                setIsConfirmOpen(false);
                            }
                        }
                    });
                    setIsConfirmOpen(true);
                } else if (result.action === 'analysis') {
                    haptic.medium();
                    setAiMessage(result.message);
                    setTranscript('');
                    transcriptRef.current = '';

                    if (!isManualTextMode) {
                        setTimeout(() => {
                            recognitionRef.current?.start();
                        }, 1000); // re-open mic after reading so user can keep asking
                    }
                } else if (result.action === 'add') {
                    const txs = result.transactions;
                    if (!txs || !Array.isArray(txs) || txs.length === 0) {
                        setAiMessage("Não consegui entender os valores para adicionar.");
                        setIsProcessing(false);
                        return;
                    }

                    // Processar todas as transações em lote
                    let totalAdded = 0;
                    for (const tx of txs) {
                        const finalDate = tx.date ? tx.date : format(new Date(), 'yyyy-MM-dd');
                        // Capitalizar primeira letra da descrição
                        const capitalizedDescription = tx.description.charAt(0).toUpperCase() + tx.description.slice(1);
                        
                        await addTx({
                            type: tx.type,
                            amount: parseFloat(tx.amount),
                            description: capitalizedDescription,
                            category: tx.category,
                            date: finalDate,
                            repeatType: tx.repeatType,
                            installments: tx.installments || 1
                        });
                        totalAdded++;
                    }

                    // Confirmação de Sucesso Polida para Múltiplos ou Único
                    if (totalAdded > 1) {
                         setAiMessage(`Tudo certo! Adicionei ${totalAdded} novos registros para você.`);
                    } else {
                         const tx = txs[0];
                         const tipoTexto = tx.type === 'income' ? 'Adicionado com sucesso' : 'Gasto registrado';
                         setAiMessage(`Tudo certo! ${tipoTexto}: ${tx.description} (R$ ${tx.amount}).`);
                    }

                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);
                    haptic.success();

                    // Fecha sozinho depois de ler
                    setTimeout(() => onClose(), 2500);
                } else if (result.action === 'limit') {
                    haptic.success();
                    setLimits({ ...limits, [result.category]: parseFloat(result.amount) });
                    setAiMessage(result.message || 'Limite definido com sucesso!');
                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);
                    setTimeout(() => onClose(), 2500);
                }
            } catch (err) {
                console.error(err);
                haptic.error();
                setAiMessage('Ocorreu um erro ao processar. Tente novamente.');
            } finally {
                setIsProcessing(false);
            }
        };
    }, [isProcessing, addTx, onClose]);

    const handleProcessManualClick = () => {
        if (transcriptRef.current.trim().length > 0 && !isProcessing) {
            processTextRef.current(transcriptRef.current);
        }
    };

    const handleSendText = () => {
        if (manualText.trim().length > 0 && !isProcessing) {
            processTextRef.current(manualText);
        }
    };

    const toggleTextMode = () => {
        setIsManualTextMode(true);
        if (transcriptRef.current) {
            setManualText(transcriptRef.current + ' ');
        }
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
        setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 100);
    };

    return (
        <div className={`ai-overlay ${isActive ? 'active' : ''} ${viewportOffset > 0 ? 'keyboard-active' : ''}`}>
            {/* Close Button - Only in TEXT mode */}
            {isManualTextMode && (
                <button 
                    onClick={onClose}
                    aria-label="Close"
                    className="ai-close-btn"
                    style={{
                        position: 'absolute', 
                        top: '16px', 
                        right: '16px',
                        width: '40px', height: '40px', borderRadius: '12px',
                        background: 'rgba(255, 255, 255, 0.1)', color: 'white',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', zIndex: 3005,
                        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)'
                    }}
                >
                    <X size={20} />
                </button>
            )}

            {/* Mic Toggle (Center) - In voice mode, this BECOMES the close button if not listening? Or just as requested: X replaces mic button when open. */}
            {!isManualTextMode && (
                <div style={{ position: 'fixed', bottom: '60px', left: '0', right: '0', zIndex: 3001, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    {isListening ? (
                        <button
                            className={`ai-mic-btn listening active`}
                            onClick={toggleListen}
                            style={{ 
                                width: '80px', height: '80px', background: 'var(--primary-gradient)', 
                                border: 'none', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.3)', cursor: 'pointer', transition: 'all 0.3s'
                            }}
                        >
                            <div className="mystical-aura"></div>
                            <Mic size={32} color="var(--btn-text)" />
                        </button>
                    ) : micPermission === 'denied' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <button
                                className="ai-voice-close-btn"
                                onClick={onClose}
                                style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', borderRadius: '12px' }}
                            >
                                <X size={24} color="#ef4444" />
                            </button>
                            <p style={{ color: '#ef4444', fontSize: '0.9rem', fontWeight: '700', textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '12px 20px', borderRadius: '16px', maxWidth: '80%' }}>
                                {t('mic_blocked', { defaultValue: 'Microfone bloqueado. Ative nas configurações do navegador para usar voz.' })}
                            </p>
                        </div>
                    ) : (
                        <button
                            className="ai-voice-close-btn"
                            onClick={onClose}
                            style={{ 
                                animation: 'slideUp 0.3s ease'
                            }}
                        >
                            <X size={24} />
                        </button>
                    )}
                    
                    {isListening && (
                        <p style={{ color: 'white', fontSize: '0.8rem', fontWeight: '700', marginTop: '12px', textAlign: 'center', opacity: 0.7 }}>
                            {t('listening_now', { defaultValue: 'OUVINDO...' })}
                        </p>
                    )}
                </div>
            )}

            <div className="ai-minimal-content">
                {/* Texto de Status no Topo - Só renderiza conteúdo se isActive (evita flash de texto na saída) */}
                <div className="ai-status-text" style={{ 
                    opacity: isActive ? 1 : 0, 
                    transition: 'opacity 0.2s',
                    paddingTop: isManualTextMode ? '20px' : '0' 
                }}>


                    {isProcessing && (
                       <div style={{ marginBottom: '20px', marginTop: '10px' }}><LoadingDots style={{ color: 'white' }} /></div>
                    )}
                    
                    {aiMessage && (
                        <div style={{
                            position: 'relative',
                            maxHeight: '55vh',
                            marginBottom: (!isProcessing && conversationContext) ? '20px' : '0',
                            overflowY: 'auto',
                            padding: '10px 0',
                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)',
                            maskImage: 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)'
                        }}>
                            <p className="ai-system-message animate-fade-in" style={{ padding: '20px 10px', maxHeight: 'none', overflowY: 'visible' }}>
                                {aiMessage}
                            </p>
                        </div>
                    )}

                    {(!aiMessage || (conversationContext && !isProcessing)) ? (
                        (isTextMode || isManualTextMode) ? (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center' }}>
                                <div style={{ textAlign: 'center', marginTop: '10px', flexShrink: 0 }}>
                                    <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                                        {t('ai_ready', { defaultValue: `Como posso ajudar${firstName ? ', ' + firstName : ''}?` })}
                                    </h3>
                                    <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>
                                        {t('ai_processing_hint', { defaultValue: 'A Inteligência Artificial irá processar as informações' })}
                                    </p>
                                </div>



                                <div 
                                    className="messaging-input-container"
                                    style={{
                                        position: 'absolute',
                                        bottom: viewportOffset > 0 ? `${viewportOffset + 50}px` : 'max(50px, env(safe-area-inset-bottom))',
                                        left: '24px',
                                        right: '24px',
                                        width: 'auto',
                                        transition: 'bottom 0.1s ease-out',
                                        zIndex: 10
                                    }}
                                >
                                    <textarea
                                        ref={inputRef}
                                        value={manualText}
                                        autoFocus
                                        onChange={(e) => setManualText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendText();
                                            }
                                        }}
                                        placeholder={conversationContext ? t('ai_status_typing') : t('ai_status_input')}
                                        className="messaging-textarea"
                                        rows={1}
                                    />
                                    <button 
                                        className="messaging-send-btn" 
                                        onClick={handleSendText} 
                                        disabled={!manualText.trim() || isProcessing}
                                    >
                                        <Send size={20} />
                                    </button>
                                </div>
                            </div>
                        ) : transcript ? (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                                <p className="spoken-text">{transcript}</p>
                                {!isProcessing && !isListening && (
                                    <button className="send-transcript-btn" onClick={handleProcessManualClick}>
                                        {t('process', { defaultValue: 'Analisar' })}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
                                <div className="ai-status-header">
                                    <h3 style={{ color: 'white', fontSize: '1.4rem', fontWeight: '600', marginBottom: '8px', opacity: 0.9 }}>
                                        {t('ai_ready', { defaultValue: firstName ? `Como posso ajudar, ${firstName}?` : "Como posso ajudar?" })}
                                    </h3>
                                </div>

                                {/* Frases Flutuantes Refinadas */}
                                {activeSuggestions.length > 0 && (
                                    <div className="suggestions-container">
                                        {activeSuggestions.map((suggestion) => (
                                            <span
                                                key={suggestion.id}
                                                className="floating-suggestion"
                                            >
                                                {suggestion.text}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    ) : null}
                </div>
            </div>

            <ConfirmDialog 
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                {...confirmConfig}
            />



            <style>{`
        .ai-overlay {
          position: fixed;
          top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0, 0, 0, 0); 
          z-index: 2000;
          opacity: 0; pointer-events: none;
          transition: all 0.5s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
        }
        .ai-overlay.active { 
          opacity: 1; 
          background: rgba(27, 69, 32, 0.4); /* Greenish brand overlay */
          pointer-events: auto; 
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        
        .mystical-aura {
          position: absolute;
          top: -20px; left: -20px; right: -20px; bottom: -20px;
          background: var(--highlight-color);
          border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%;
          z-index: -1;
          filter: blur(25px);
          animation: blobMorph 5s linear infinite alternate;
          opacity: 0.5;
          display: none;
        }

        .ai-mic-btn.listening .mystical-aura {
          display: block;
          animation: blobMorph 4s linear infinite alternate, intenseOrganicGlow 1.5s ease-in-out infinite alternate;
        }

        /* Voice Mode Close Button - Replaces Mic style */
        .ai-voice-close-btn {
          width: 60px;
          height: 60px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: all 0.3s;
        }
        .ai-voice-close-btn:active {
          transform: scale(0.9);
        }

        @keyframes blobMorph {
          0% { border-radius: 40% 60% 70% 30% / 40% 40% 60% 50%; transform: rotate(0deg) scale(0.9); }
          50% { border-radius: 70% 30% 50% 50% / 30% 30% 70% 70%; transform: rotate(180deg) scale(1.1); }
          100% { border-radius: 40% 60% 70% 30% / 40% 40% 60% 50%; transform: rotate(360deg) scale(0.9); }
        }
        
        @keyframes intenseOrganicGlow {
          0% { opacity: 0.5; filter: blur(20px); }
          100% { opacity: 1; filter: blur(35px); }
        }

        .ai-mic-btn {
          width: 68px;
          height: 68px;
          border-radius: 50%;
          border: none;
          background: var(--primary-gradient);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 30px rgba(27, 69, 32, 0.5);
          cursor: pointer;
          position: relative;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          z-index: 2001;
        }

        .ai-mic-btn img {
          width: 28px;
          height: 28px;
          object-fit: contain;
          transition: transform 0.3s ease;
        }

        .ai-mic-btn.active {
          transform: scale(0.9) translateY(5px);
          box-shadow: 0 5px 15px rgba(75, 180, 90, 0.4);
        }
        
        .ai-minimal-content {
          width: 100%; height: 100%;
          display: flex; flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          padding: 15vh 24px 80px;
          /* Relative for sticky child */
          position: relative;
          transition: padding-top 0.3s ease;
        }

        .ai-overlay.keyboard-active .ai-minimal-content {
          padding-top: 5vh;
        }
        @media (min-width: 1024px) {
            .ai-minimal-content {
                padding: 40px;
                max-width: 800px;
                height: auto;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 32px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 40px 100px rgba(0,0,0,0.4);
            }
        }

        .ai-status-text {
          margin-top: 40px;
          text-align: center;
          width: 100%;
        }

        .ai-greeting { 
          font-family: 'Solway', serif;
          font-size: 1.5rem; 
          color: #ffffff; 
          font-weight: 500; 
          line-height: 1.4;
          opacity: 0.9;
        }
        
        .spoken-text { 
           font-family: 'Solway', serif;
           font-size: 1.5rem; 
           color: #ffffff; 
           font-weight: 500; 
           line-height: 1.4; 
        }
        
        .ai-system-message {
           font-family: 'Solway', serif;
           font-size: 1.5rem;
           color: #ffffff;
           font-weight: 500;
           line-height: 1.5;
           text-align: center;
           max-height: 60vh;
           overflow-y: auto;
           padding: 10px;
        }
        
        .dots {
          animation: blink 1.5s infinite both;
        }
        @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
        

        
        .send-transcript-btn {
          background: var(--primary-darkest); color: var(--btn-text);
          padding: 14px 32px; border-radius: var(--border-radius-full);
          font-weight: 600; font-size: 1.1rem; 
          animation: slideUp 0.3s forwards;
          box-shadow: 0 4px 12px rgba(14, 34, 16, 0.2);
          border: none;
        }

        .send-transcript-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Sticky Input Container (WhatsApp Style) */
        .messaging-input-container {
            position: absolute;
            bottom: max(20px, env(safe-area-inset-bottom));
            left: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 28px;
            padding: 8px 8px 8px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 3010;
        }

        .messaging-textarea {
            flex: 1;
            background: transparent;
            border: none;
            color: white;
            font-size: 1.1rem;
            font-family: inherit;
            outline: none;
            resize: none;
            padding: 10px 0;
            max-height: 150px;
        }

        .messaging-textarea::placeholder {
            color: rgba(255, 255, 255, 0.4);
        }

        .messaging-send-btn {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: var(--primary-gradient);
            border: none;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s;
        }

        .messaging-send-btn:active {
            transform: scale(0.9);
        }

        .messaging-send-btn:disabled {
            opacity: 0.3;
            filter: grayscale(1);
        }

        .ai-status-header {
            text-align: center;
            margin-top: 20px;
        }

        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .suggestions-container {
            position: relative;
            width: 100%;
            height: 80px;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 10px;
            overflow: hidden;
        }

        .floating-suggestion {
            position: absolute;
            color: rgba(255, 255, 255, 0.9);
            font-family: 'Solway', serif;
            animation: verticalRoulette 5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            pointer-events: none;
            text-align: center;
            width: 90%;
            font-size: 1.15rem;
            line-height: 1.4;
            display: flex;
            justify-content: center;
            align-items: center;
            font-weight: 500;
        }



        @keyframes verticalRoulette {
            0% { opacity: 0; transform: translateY(30px) scale(0.95); }
            10% { opacity: 1; transform: translateY(0) scale(1); }
            90% { opacity: 1; transform: translateY(0) scale(1); }
            100% { opacity: 0; transform: translateY(-30px) scale(0.95); }
        }
      `}</style>
        </div>
    );
};

export default AiPanel;
