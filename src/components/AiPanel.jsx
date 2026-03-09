import React, { useState, useEffect, useRef } from 'react';
import { Mic, Plus, Edit2, Send } from 'lucide-react';
import { analyzeTextWithGemini } from '../services/geminiService';
import { useTransactions } from '../hooks/useTransactions';
import { format } from 'date-fns';
import { useI18n } from '../contexts/I18nContext';
import { useAuth } from '../contexts/AuthContext';

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
    "Delete a última transação que fiz",
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

const AiPanel = ({ isActive, onClose, onOpenManualModal, onListeningChange }) => {
    const [isListening, setIsListening] = useState(false);
    const { currentUser } = useAuth();

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
    const inputRef = useRef(null);
    const recognitionRef = useRef(null);
    const silenceTimeoutRef = useRef(null);
    const transcriptRef = useRef(''); // To keep latest state for timeout

    const { transactions, addTx, deleteTx } = useTransactions(format(new Date(), 'yyyy-MM'));
    const { t, locale } = useI18n();

    // Setup Speech Recognition
    useEffect(() => {
        // Verificar suporte da API nativa do navegador
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'pt-BR';

            recognition.onstart = () => {
                setIsListening(true);
            };

            recognition.onresult = (event) => {
                let currentTranscript = '';
                for (let i = 0; i < event.results.length; ++i) {
                    currentTranscript += event.results[i][0].transcript;
                }
                setTranscript(currentTranscript);
                transcriptRef.current = currentTranscript;

                // Clear existing silence timeout
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);

                // Set new timeout to autosubmit after 2 seconds of silence
                silenceTimeoutRef.current = setTimeout(() => {
                    if (transcriptRef.current.trim().length > 0 && !isProcessing) {
                        processTextRef.current(transcriptRef.current);
                    }
                }, 1500);
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error', event.error);
                setIsListening(false);
                if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            };

            recognition.onend = () => {
                setIsListening(false);
                // Try to process if ended and we have transcript
                if (transcriptRef.current.trim().length > 0 && !isProcessing) {
                    processTextRef.current(transcriptRef.current);
                }
            };

            recognitionRef.current = recognition;
        }
    }, []);

    // Monitora mudança na prop isActive do bottom-nav para ligar o microfone automaticamente
    useEffect(() => {
        if (isActive) {
            setTranscript('');
            transcriptRef.current = '';
            setAiMessage('');
            setIsManualTextMode(false);
            setManualText('');
            setConversationContext(null);

            // Try starting automatically
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.start();
                } catch (e) {
                    console.error("Auto-start failure", e);
                }
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        } else {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
            if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
            setIsListening(false);
        }
    }, [isActive]);

    // Lógica das frases flutuantes (Refinada: uma por vez com cross-fade)
    useEffect(() => {
        let interval;
        if (isActive && isListening && !transcript && !aiMessage) {
            const pickNext = () => {
                const phrase = AI_SUGGESTIONS[Math.floor(Math.random() * AI_SUGGESTIONS.length)];
                setActiveSuggestions(prev => {
                    // Mantemos apenas as 2 últimas para o efeito de cross-fade
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
            recognitionRef.current?.stop();
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

            setAiMessage(t('ai_status_thinking', { defaultValue: 'Analisando...' }));

            try {
                const result = await analyzeTextWithGemini(textToProcess, transactions, conversationContext, locale);
                console.log("GEMINI RAW RESULT:", result); // DEBUGS

                if (result.error) {
                    console.error("Gemini returned an error flag:", result.error);
                    setAiMessage(result.error);
                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);
                } else if (result.action === 'need_info') {
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
                    await deleteTx(result.targetId);
                    setAiMessage(result.message || "A transação foi removida.");
                    setTranscript('');
                    transcriptRef.current = '';
                    setTimeout(() => onClose(), 2500);
                } else if (result.action === 'analysis') {
                    setAiMessage(result.message);
                    setTranscript('');
                    transcriptRef.current = '';
                    // We don't auto-close the panel on analysis so the user has time to read it.
                } else if (result.action === 'add') {
                    const tx = result.transaction;
                    const finalDate = tx.date ? tx.date : format(new Date(), 'yyyy-MM-dd');

                    await addTx({
                        type: tx.type,
                        amount: parseFloat(tx.amount),
                        description: tx.description,
                        category: tx.category,
                        date: finalDate,
                        repeatType: tx.repeatType,
                        installments: tx.installments || 1
                    });

                    // Confirmação de Sucesso Polida e Curta
                    const tipoTexto = tx.type === 'income' ? 'Adicionado com sucesso' : 'Gasto registrado';
                    setAiMessage(`Tudo certo! ${tipoTexto}: ${tx.description} (R$ ${tx.amount}).`);

                    setTranscript('');
                    transcriptRef.current = '';
                    setConversationContext(null);

                    // Fecha sozinho depois de ler
                    setTimeout(() => onClose(), 2500);
                }
            } catch (err) {
                console.error(err);
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
        <div className={`ai-overlay ${isActive ? 'active' : ''}`}>

            <div className="ai-minimal-content">
                {/* Texto de Status no Topo - Só renderiza conteúdo se isActive (evita flash de texto na saída) */}
                <div className="ai-status-text" style={{ opacity: isActive ? 1 : 0, transition: 'opacity 0.2s' }}>
                    {aiMessage && (
                        <p className="ai-system-message animate-fade-in" style={{ marginBottom: (!isProcessing && conversationContext) ? '20px' : '0' }}>
                            {aiMessage}
                        </p>
                    )}

                    {(!aiMessage || (conversationContext && !isProcessing)) ? (
                        isManualTextMode ? (
                            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '16px', alignItems: 'center' }}>
                                <textarea
                                    ref={inputRef}
                                    value={manualText}
                                    onChange={(e) => setManualText(e.target.value)}
                                    placeholder={conversationContext ? t('ai_status_typing') : t('ai_status_input')}
                                    className="manual-text-input"
                                    rows={3}
                                />
                                <button className="send-transcript-btn" onClick={handleSendText} disabled={!manualText.trim() || isProcessing} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Send size={18} /> {t('process')}
                                </button>
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
                                <p className="ai-greeting" style={{ marginTop: '0' }}>
                                    {isListening ? (
                                        <>{t('ai_status_listening', { defaultValue: `Olá, ${currentUser?.displayName?.split(' ')[0] || t('user', { defaultValue: 'Usuário' })}! Como posso te ajudar hoje?` })}</>
                                    ) : (
                                        <>{t('ai_greeting_idle', { defaultValue: 'A inteligência artificial está \n disponível para ajudar' })}</>
                                    )}
                                </p>

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

            {/* Float Write Input Chip */}
            {isActive && !isManualTextMode && (
                <button
                    onClick={toggleTextMode}
                    className="animate-fade-in"
                    style={{
                        position: 'absolute',
                        bottom: '120px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        cursor: 'pointer',
                        zIndex: 2002
                    }}
                >
                    <Edit2 size={24} />
                </button>
            )}

            <style>{`
        .ai-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0; 
          background: rgba(0, 0, 0, 0.5); 
          backdrop-filter: blur(40px);
          -webkit-backdrop-filter: blur(40px);
          z-index: 2000;
          opacity: 0; pointer-events: none;
          transition: opacity 0.5s ease;
          display: none;
        }
        .ai-overlay.active { 
          opacity: 1; 
          pointer-events: auto; 
          display: block;
        }
        
        .mystical-aura {
          position: absolute;
          top: -15px; left: -15px; right: -15px; bottom: -15px;
          background: var(--highlight-color);
          border-radius: 50%;
          z-index: -1;
          filter: blur(25px);
          animation: auricPulse 2s infinite alternate ease-in-out;
          opacity: 0.8;
          display: none;
        }

        .ai-mic-btn.listening .mystical-aura {
          display: block;
          animation: intensePulse 0.4s infinite alternate ease-in-out;
        }

        @keyframes auricPulse {
          0% { transform: scale(0.9); opacity: 0.5; filter: blur(20px); }
          100% { transform: scale(1.1); opacity: 0.8; filter: blur(25px); }
        }
        
        @keyframes intensePulse {
          0% { transform: scale(0.9); opacity: 0.6; filter: blur(20px); }
          100% { transform: scale(1.4); opacity: 1; filter: blur(35px); }
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
          padding: 80px 24px;
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
          background: var(--primary-darkest); color: white;
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

        .manual-text-input {
            width: 90%;
            max-width: 400px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 16px;
            padding: 16px;
            color: white;
            font-size: 1.5rem;
            line-height: 1.5;
            font-family: inherit;
            outline: none;
            resize: none;
            backdrop-filter: blur(10px);
            animation: fadeInScale 0.3s forwards;
            text-align: center;
        }

        .manual-text-input::placeholder {
            color: rgba(255,255,255,0.5);
        }

        .suggestions-container {
            position: relative;
            width: 100%;
            height: 0;
            display: flex;
            justify-content: center;
        }

        .floating-suggestion {
            position: absolute;
            color: rgba(255, 255, 255, 0.8);
            font-family: 'Solway', serif;
            animation: smoothFade 6s ease-in-out forwards;
            pointer-events: none;
            text-align: center;
            width: 80%;
            max-width: 320px;
            font-size: 1.3rem;
            line-height: 1.4;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        @keyframes smoothFade {
            0% { opacity: 0; transform: translateY(15px); }
            20% { opacity: 0.8; transform: translateY(0); }
            80% { opacity: 0.8; transform: translateY(-10px); }
            100% { opacity: 0; transform: translateY(-25px); }
        }
      `}</style>
        </div>
    );
};

export default AiPanel;
